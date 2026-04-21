import { join } from 'path';
import { Database } from './db';
import { Agent } from '../agent/agent';
import { Model } from '../foundation/models/model';
import { createCodingAgent } from '../coding/agents/create-agent';
import type { ModelProvider } from '../foundation/models/provider';
import type { StreamCallback } from '../community/stream-types';
import { createUserMessage } from '../foundation/messages';
import type { AssistantMessage, ToolMessage } from '../foundation/messages/types';
import type { AgentStateEvent, Trajectory } from '../agent/trajectory';
import type { AskUserQuestion } from '../coding/tools/ask-user';
import { setAskUserHandler } from '../coding/tools';

const ASK_USER_TIMEOUT_MS = 5 * 60 * 1000;
const ASK_USER_UNRESPONSIVE_RESPONSE =
  '[User is unresponsive this session. Proceed with best judgment without blocking on user input. Do not invoke ask_user again until the user sends a new message.]';

// Destructive verbs — any option matching these cannot be auto-selected, even
// if the LLM flagged it as isSafeDefault.
const DESTRUCTIVE_EN = /\b(delete|remove|overwrite|drop|rm|destroy|wipe|erase|discard|reset|force)\b/i;
const DESTRUCTIVE_ZH = /删除|清空|覆盖|销毁|抹除|重置|丢弃|强制/;
// Safe no-op verbs — heuristic fallback when no explicit isSafeDefault.
const SAFE_NOOP_EN = /\b(skip|cancel|abort|keep|none|don't|dont|preserve|ignore)\b/i;
const SAFE_NOOP_ZH = /跳过|取消|保留|保持|忽略|不要|放弃/;

function isDestructive(text: string): boolean {
  return DESTRUCTIVE_EN.test(text) || DESTRUCTIVE_ZH.test(text);
}

function isSafeNoop(text: string): boolean {
  return SAFE_NOOP_EN.test(text) || SAFE_NOOP_ZH.test(text);
}

type SafeOption = NonNullable<AskUserQuestion['options']>[number];
type SafePick = { option: SafeOption; source: 'explicit' | 'heuristic' };

function pickSafeDefault(options: AskUserQuestion['options']): SafePick | undefined {
  if (!options?.length) return undefined;

  // Layer 1: explicit LLM hint wins — but only if it doesn't look destructive.
  // If multiple options are tagged, treat as unreliable and fall through.
  const tagged = options.filter((o) => o.isSafeDefault);
  if (tagged.length === 1) {
    const t = tagged[0];
    if (!isDestructive(`${t.label} ${t.value}`)) {
      return { option: t, source: 'explicit' };
    }
  }

  // Layer 2: heuristic — first option whose label/value matches safe no-op
  // keywords AND is not destructive (e.g. "skip deletion" = safe, "delete" alone = destructive)
  for (const o of options) {
    const text = `${o.label} ${o.value}`;
    if (isSafeNoop(text) && !isDestructive(text)) {
      return { option: o, source: 'heuristic' };
    }
  }

  // Layer 3: give up — no auto-select, caller falls back to echo branch.
  return undefined;
}

function buildTimeoutResponse(question: AskUserQuestion): { response: string; autoSelected?: string } {
  const safe = pickSafeDefault(question.options);
  if (safe) {
    const note = safe.source === 'heuristic'
      ? ' (picked by heuristic — no explicit safe marker was set)'
      : '';
    return {
      response: `[Auto-fallback after 5-minute timeout: selected "${safe.option.label}" (value: ${safe.option.value})${note}. Treat this as a best-effort default, not a real user choice.]`,
      autoSelected: safe.option.value,
    };
  }
  const optionsEcho = question.options?.length
    ? ` Available options were: ${question.options.map((o) => `"${o.label}" (${o.value})`).join(', ')}.`
    : '';
  return {
    response: `[Timeout on question "${question.question}" after 5 minutes.${optionsEcho} Proceed with best judgment. DO NOT re-invoke ask_user for this question.]`,
  };
}

export class ThreadManager {
  private agents: Map<string, Agent> = new Map();
  private skillControllers: Map<string, { setRequestedSkill(name: string | null): void }> = new Map();
  private askUserResolvers: Map<string, (response: string) => void> = new Map();
  private askUserTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private askUserTimedOutThreads: Set<string> = new Set();
  public onStreamDelta?: (threadId: string, event: any) => void;
  public onStateChange?: (event: AgentStateEvent) => void;
  public onPlanUpdate?: (threadId: string, items: any[]) => void;
  public onAskUser?: (threadId: string, question: AskUserQuestion) => void;
  public onAskUserTimeout?: (threadId: string, autoSelectedValue?: string) => void;

  constructor(
    private db: Database,
    private providers: Map<string, ModelProvider>,
    private appRoot: string,
  ) {
    // Wire up ask_user tool globally — routes through IPC to renderer
    setAskUserHandler((q) => this.handleAskUser(q));
  }

  /** Called when agent invokes ask_user — sends to renderer and waits (with 5-min timeout) */
  private handleAskUser(question: AskUserQuestion): Promise<string> {
    // Find which thread is currently streaming (the one that called ask_user)
    // Use a simple heuristic: the thread with an active agent
    const threadId = this.activeThreadId;
    if (!threadId) return Promise.resolve('[No active thread]');

    // Short-circuit: if an earlier ask_user in this session already timed out,
    // skip blocking on subsequent questions until the user sends a new message.
    if (this.askUserTimedOutThreads.has(threadId)) {
      return Promise.resolve(ASK_USER_UNRESPONSIVE_RESPONSE);
    }

    return new Promise<string>((resolve) => {
      this.askUserResolvers.set(threadId, resolve);
      const timer = setTimeout(() => {
        // Only timeout-resolve if this resolver is still pending
        if (this.askUserResolvers.get(threadId) === resolve) {
          this.askUserResolvers.delete(threadId);
          this.askUserTimers.delete(threadId);
          this.askUserTimedOutThreads.add(threadId);
          const { response, autoSelected } = buildTimeoutResponse(question);
          this.onAskUserTimeout?.(threadId, autoSelected);
          resolve(response);
        }
      }, ASK_USER_TIMEOUT_MS);
      this.askUserTimers.set(threadId, timer);
      this.onAskUser?.(threadId, question);
    });
  }

  /** Called from IPC when user responds to ask_user card */
  respondToAskUser(threadId: string, response: string): void {
    const resolve = this.askUserResolvers.get(threadId);
    if (!resolve) return;
    this.askUserResolvers.delete(threadId);
    const timer = this.askUserTimers.get(threadId);
    if (timer) {
      clearTimeout(timer);
      this.askUserTimers.delete(threadId);
    }
    resolve(response);
  }

  private activeThreadId: string | null = null;

  createThread(params: {
    id?: string;
    title: string;
    projectPath: string;
    modelId: string;
    mode: 'local' | 'worktree';
  }): string {
    return this.db.createThread(params);
  }

  listThreads() {
    return this.db.listThreads();
  }

  deleteThread(id: string): void {
    this.abortAgent(id);
    this.respondToAskUser(id, '[Thread deleted]');
    this.agents.delete(id);
    this.skillControllers.delete(id);
    this.db.deleteThread(id);
  }

  getMessages(threadId: string) {
    return this.db.getMessages(threadId);
  }

  async *sendMessage(threadId: string, text: string, skillName?: string): AsyncGenerator<AssistantMessage | ToolMessage> {
    this.activeThreadId = threadId;
    // Fresh user message clears prior ask_user timeout short-circuit for this thread
    this.askUserTimedOutThreads.delete(threadId);
    const agent = await this.getOrCreateAgent(threadId);

    // Set requested skill if provided (e.g., from QuickCard click)
    if (skillName) {
      this.skillControllers.get(threadId)?.setRequestedSkill(skillName);
    }

    // Set up stream callback on provider before each call
    // Uses duck-typing: any provider with onStream property gets the callback
    const thread = this.db.getThread(threadId);
    if (thread) {
      const provider = this.resolveProvider(thread.model_id) as any;
      if ('onStream' in provider && (provider.supportsStreaming ?? true)) {
        provider.onStream = (event: any) => this.onStreamDelta?.(threadId, event);
      }
    }

    const userMessage = createUserMessage(text);
    this.db.addMessage(threadId, { role: 'user', content: userMessage.content });

    for await (const msg of agent.stream(userMessage)) {
      this.db.addMessage(threadId, { role: msg.role, content: msg.content });
      yield msg;
    }

    this.activeThreadId = null;

    // Save trajectory after successful stream completion
    const trajectory = agent.getLastTrajectory();
    if (trajectory) {
      this.saveTrajectory(trajectory);
    }
  }

  private saveTrajectory(trajectory: Trajectory): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const { app } = require('electron');
      const dir = path.join(app.getPath('userData'), 'trajectories');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `${trajectory.threadId}-${trajectory.startedAt}.json`;
      fs.writeFileSync(path.join(dir, filename), JSON.stringify(trajectory, null, 2));
    } catch {
      // Non-critical: silently ignore save failures
    }
  }

  isAnyAgentStreaming(): boolean {
    return this.activeThreadId !== null;
  }

  abortAgent(threadId: string): void {
    this.agents.get(threadId)?.abort();
  }

  private async getOrCreateAgent(threadId: string): Promise<Agent> {
    if (this.agents.has(threadId)) return this.agents.get(threadId)!;

    const thread = this.db.getThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    // Load conversation history from DB
    const dbMessages = this.db.getMessages(threadId);
    const historyMessages = dbMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'tool',
      content: m.content as any[],
    }));

    const provider = this.resolveProvider(thread.model_id);
    const model = new Model(thread.model_id, provider);
    const { agent, skillsController } = await createCodingAgent({
      model,
      cwd: thread.project_path,
      skillsDirs: [join(this.appRoot, 'skills'), join(thread.project_path, 'skills')],
      threadId,
      onStateChange: (event) => this.onStateChange?.(event),
      onPlanUpdate: (items) => this.onPlanUpdate?.(threadId, items),
      historyMessages,
    });

    this.agents.set(threadId, agent);
    this.skillControllers.set(threadId, skillsController);
    return agent;
  }

  private resolveProvider(modelId: string): ModelProvider {
    // Named routing: model prefix → provider key
    const routes: Array<[string, string[]]> = [
      ['MiniMax', ['minimax']],
      ['glm', ['glm']],
      ['ep-', ['ark']],
    ];

    for (const [prefix, keys] of routes) {
      if (modelId.startsWith(prefix)) {
        for (const key of keys) {
          const p = this.providers.get(key);
          if (p) return p;
        }
      }
    }

    // E2E mock — single 'mock' key handles everything
    const mock = this.providers.get('mock');
    if (mock) return mock;

    // Generic fallback: openai → first available
    const fallback = this.providers.get('openai');
    if (fallback) return fallback;

    const first = this.providers.values().next();
    if (!first.done) return first.value;
    throw new Error(`No provider configured for model: ${modelId}`);
  }
}
