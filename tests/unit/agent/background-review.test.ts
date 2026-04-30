import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BackgroundReviewMiddleware,
  type ReviewCompleteEvent,
} from '@/agent/middlewares/background-review';
import { loadMemory, MemoryStore } from '@/agent/memory';
import type { ModelProvider } from '@/foundation/models/provider';
import type { AssistantMessage, Message } from '@/foundation/messages/types';

interface ReviewCallEnvelope {
  model: string;
  messages: Message[];
  toolNames: string[];
}

class CapturingProvider implements ModelProvider {
  public calls: ReviewCallEnvelope[] = [];
  constructor(private readonly response: AssistantMessage | (() => AssistantMessage)) {}
  async invoke(params: { model: string; messages: Message[]; tools?: any[] }): Promise<AssistantMessage> {
    this.calls.push({
      model: params.model,
      messages: params.messages,
      toolNames: (params.tools ?? []).map((t) => t.name),
    });
    return typeof this.response === 'function' ? this.response() : this.response;
  }
}

function memoryToolUse(target: 'env' | 'user', line: string): AssistantMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: `mw-${Math.random()}`,
        name: 'memory_write',
        input: { target, line },
      },
    ],
  };
}

function skillToolUse(input: Record<string, unknown>): AssistantMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: `sc-${Math.random()}`,
        name: 'skill_create',
        input,
      },
    ],
  };
}

function noopText(): AssistantMessage {
  return { role: 'assistant', content: [{ type: 'text', text: 'noop' }] };
}

describe('BackgroundReviewMiddleware', () => {
  let tempHome: string;
  let projectDir: string;
  const originalHome = process.env.TINY_CODEX_HOME;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'tinycdx-rev-'));
    projectDir = mkdtempSync(join(tmpdir(), 'tinycdx-prj-'));
    process.env.TINY_CODEX_HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.TINY_CODEX_HOME;
    else process.env.TINY_CODEX_HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('schedules a memory review when turn threshold is reached', async () => {
    const snap = await loadMemory(projectDir);
    const store = new MemoryStore(snap);
    const provider = new CapturingProvider(memoryToolUse('env', 'pnpm is the package manager'));
    const events: ReviewCompleteEvent[] = [];
    const mw = new BackgroundReviewMiddleware({
      memoryStore: store,
      provider,
      memoryNudgeTurns: 2,
      skillNudgeIters: 999, // disable skill side
      scheduler: (cb) => cb(),
      onReviewComplete: (e) => events.push(e),
    });

    // Simulate 2 model+step loops with at least 1 message in trace
    await mw.afterModel({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    await mw.afterAgentStep(1);
    await mw.afterAgentStep(2);
    await mw.flush();

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].toolNames).toEqual(['memory_write']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ mode: 'memory', ok: true, memoriesAdded: 1 });
    const memoryFile = readFileSync(snap.paths.globalEnv, 'utf-8');
    expect(memoryFile).toContain('pnpm is the package manager');
  });

  it('schedules a skill review when tool iter threshold is reached', async () => {
    const snap = await loadMemory(projectDir);
    const store = new MemoryStore(snap);
    const provider = new CapturingProvider(
      skillToolUse({
        name: 'capture-logs',
        description: 'Capture failing CI logs',
        triggers: ['CI failure'],
        body: 'Step 1: download artifact. Step 2: grep stack.',
      }),
    );
    const events: ReviewCompleteEvent[] = [];
    const mw = new BackgroundReviewMiddleware({
      memoryStore: store,
      provider,
      memoryNudgeTurns: 999,
      skillNudgeIters: 2,
      scheduler: (cb) => cb(),
      onReviewComplete: (e) => events.push(e),
    });

    await mw.afterModel({ role: 'assistant', content: [{ type: 'text', text: 'doing' }] });
    await mw.afterToolUse({ type: 'tool_use', id: 'a', name: 'bash', input: {} }, 'log line');
    await mw.afterToolUse({ type: 'tool_use', id: 'b', name: 'bash', input: {} }, 'another log');
    await mw.flush();

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].toolNames).toEqual(['skill_create']);
    expect(events[0]).toMatchObject({ mode: 'skill', ok: true, skillsProposed: 1 });
    expect(existsSync(join(tempHome, 'skills', '_pending', 'capture-logs', 'SKILL.md'))).toBe(true);
  });

  it('handles a noop response gracefully', async () => {
    const snap = await loadMemory(projectDir);
    const store = new MemoryStore(snap);
    const provider = new CapturingProvider(noopText());
    const events: ReviewCompleteEvent[] = [];
    const mw = new BackgroundReviewMiddleware({
      memoryStore: store,
      provider,
      memoryNudgeTurns: 1,
      skillNudgeIters: 999,
      scheduler: (cb) => cb(),
      onReviewComplete: (e) => events.push(e),
    });
    await mw.afterModel({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
    await mw.afterAgentStep(1);
    await mw.flush();
    expect(events[0]).toMatchObject({ mode: 'memory', ok: true, memoriesAdded: 0, toolCalls: 0 });
  });

  it('captures provider errors without blowing up the main flow', async () => {
    const snap = await loadMemory(projectDir);
    const store = new MemoryStore(snap);
    const failing: ModelProvider = {
      async invoke() {
        throw new Error('boom');
      },
    };
    const events: ReviewCompleteEvent[] = [];
    const mw = new BackgroundReviewMiddleware({
      memoryStore: store,
      provider: failing,
      memoryNudgeTurns: 1,
      skillNudgeIters: 999,
      scheduler: (cb) => cb(),
      onReviewComplete: (e) => events.push(e),
    });
    await mw.afterModel({ role: 'assistant', content: [{ type: 'text', text: 'x' }] });
    await mw.afterAgentStep(1);
    await mw.flush();
    expect(events[0]).toMatchObject({ ok: false, error: 'boom' });
  });

  it('does not trigger review with empty trace', async () => {
    const snap = await loadMemory(projectDir);
    const store = new MemoryStore(snap);
    const provider = new CapturingProvider(noopText());
    const mw = new BackgroundReviewMiddleware({
      memoryStore: store,
      provider,
      memoryNudgeTurns: 1,
      skillNudgeIters: 999,
      scheduler: (cb) => cb(),
    });
    // No afterModel call → no trace
    await mw.afterAgentStep(1);
    await mw.flush();
    expect(provider.calls).toHaveLength(0);
  });
});
