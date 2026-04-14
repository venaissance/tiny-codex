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

export class ThreadManager {
  private agents: Map<string, Agent> = new Map();
  private skillControllers: Map<string, { setRequestedSkill(name: string | null): void }> = new Map();
  private askUserResolvers: Map<string, (response: string) => void> = new Map();
  public onStreamDelta?: (threadId: string, event: any) => void;
  public onStateChange?: (event: AgentStateEvent) => void;
  public onPlanUpdate?: (threadId: string, items: any[]) => void;
  public onAskUser?: (threadId: string, question: AskUserQuestion) => void;

  constructor(
    private db: Database,
    private providers: Map<string, ModelProvider>,
    private appRoot: string,
  ) {
    // Wire up ask_user tool globally — routes through IPC to renderer
    setAskUserHandler((q) => this.handleAskUser(q));
  }

  /** Called when agent invokes ask_user — sends to renderer and waits */
  private handleAskUser(question: AskUserQuestion): Promise<string> {
    // Find which thread is currently streaming (the one that called ask_user)
    // Use a simple heuristic: the thread with an active agent
    const threadId = this.activeThreadId;
    if (!threadId) return Promise.resolve('[No active thread]');

    return new Promise<string>((resolve) => {
      this.askUserResolvers.set(threadId, resolve);
      this.onAskUser?.(threadId, question);
    });
  }

  /** Called from IPC when user responds to ask_user card */
  respondToAskUser(threadId: string, response: string): void {
    const resolve = this.askUserResolvers.get(threadId);
    if (resolve) {
      this.askUserResolvers.delete(threadId);
      resolve(response);
    }
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
    this.agents.delete(id);
    this.skillControllers.delete(id);
    this.db.deleteThread(id);
  }

  getMessages(threadId: string) {
    return this.db.getMessages(threadId);
  }

  async *sendMessage(threadId: string, text: string, skillName?: string): AsyncGenerator<AssistantMessage | ToolMessage> {
    this.activeThreadId = threadId;
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
