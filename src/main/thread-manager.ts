import { Database } from './db';
import { Agent } from '../agent/agent';
import { Model } from '../foundation/models/model';
import { createCodingAgent } from '../coding/agents/create-agent';
import type { ModelProvider } from '../foundation/models/provider';
import { AnthropicModelProvider, type StreamCallback } from '../community/anthropic/provider';
import { createUserMessage } from '../foundation/messages';
import type { AssistantMessage, ToolMessage } from '../foundation/messages/types';
import type { AgentStateEvent, Trajectory } from '../agent/trajectory';

export class ThreadManager {
  private agents: Map<string, Agent> = new Map();
  public onStreamDelta?: (threadId: string, event: any) => void;
  public onStateChange?: (event: AgentStateEvent) => void;

  constructor(
    private db: Database,
    private providers: Map<string, ModelProvider>,
  ) {}

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
    this.db.deleteThread(id);
  }

  getMessages(threadId: string) {
    return this.db.getMessages(threadId);
  }

  async *sendMessage(threadId: string, text: string): AsyncGenerator<AssistantMessage | ToolMessage> {
    const agent = await this.getOrCreateAgent(threadId);

    // Set up stream callback on provider before each call
    const thread = this.db.getThread(threadId);
    if (thread) {
      const provider = this.resolveProvider(thread.model_id);
      if (provider instanceof AnthropicModelProvider) {
        provider.onStream = (event) => {
          this.onStreamDelta?.(threadId, event);
        };
      }
    }

    const userMessage = createUserMessage(text);
    this.db.addMessage(threadId, { role: 'user', content: userMessage.content });

    for await (const msg of agent.stream(userMessage)) {
      this.db.addMessage(threadId, { role: msg.role, content: msg.content });
      yield msg;
    }

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

  abortAgent(threadId: string): void {
    this.agents.get(threadId)?.abort();
  }

  private async getOrCreateAgent(threadId: string): Promise<Agent> {
    if (this.agents.has(threadId)) return this.agents.get(threadId)!;

    const thread = this.db.getThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    const provider = this.resolveProvider(thread.model_id);
    const model = new Model(thread.model_id, provider);
    const agent = await createCodingAgent({
      model,
      cwd: thread.project_path,
      threadId,
      onStateChange: (event) => this.onStateChange?.(event),
    });

    this.agents.set(threadId, agent);
    return agent;
  }

  private resolveProvider(modelId: string): ModelProvider {
    if (modelId.startsWith('claude') || modelId.startsWith('MiniMax')) {
      const p = this.providers.get('anthropic');
      if (p) return p;
    }
    const p = this.providers.get('openai');
    if (p) return p;
    const fallback = this.providers.get('anthropic');
    if (fallback) return fallback;
    throw new Error(`No provider configured for model: ${modelId}`);
  }
}
