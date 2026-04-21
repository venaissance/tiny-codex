import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import os from 'os';
import { ThreadManager } from '@/main/thread-manager';
import { Database } from '@/main/db';
import { askUserTool } from '@/coding/tools';

describe('ThreadManager ask_user timeout', () => {
  let tmpDir: string;
  let db: Database;
  let tm: ThreadManager;
  let threadId: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-askto-'));
    db = new Database(join(tmpDir, 'test.db'));
    await db.ensureReady();
    tm = new ThreadManager(db, new Map(), '/tmp/app');
    threadId = tm.createThread({
      title: 't',
      projectPath: '/tmp',
      modelId: 'mock',
      mode: 'local',
    });
    // Simulate active streaming so handleAskUser finds a threadId
    (tm as any).activeThreadId = threadId;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('no options → echoes question + hard constraint against re-invocation', async () => {
    const timeoutSpy = vi.fn();
    tm.onAskUserTimeout = timeoutSpy;

    const promise = askUserTool.invoke({ question: 'pick one' });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('Timeout on question "pick one"');
    expect(result).toContain('DO NOT re-invoke ask_user');
    expect(timeoutSpy).toHaveBeenCalledWith(threadId, undefined);
  });

  it('options with isSafeDefault → auto-selects safe option value', async () => {
    const timeoutSpy = vi.fn();
    tm.onAskUserTimeout = timeoutSpy;

    const promise = askUserTool.invoke({
      question: 'overwrite file?',
      options: [
        { label: 'Overwrite', value: 'overwrite' },
        { label: 'Skip', value: 'skip', isSafeDefault: true },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('Auto-fallback');
    expect(result).toContain('"Skip"');
    expect(result).toContain('value: skip');
    expect(timeoutSpy).toHaveBeenCalledWith(threadId, 'skip');
  });

  it('options without isSafeDefault → echoes options list, no auto-select', async () => {
    const promise = askUserTool.invoke({
      question: 'delete dir?',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('Timeout on question "delete dir?"');
    expect(result).toContain('Available options were: "Yes" (yes), "No" (no)');
    expect(result).toContain('DO NOT re-invoke ask_user');
  });

  it('destructive option flagged isSafeDefault is vetoed → falls through to heuristic', async () => {
    const timeoutSpy = vi.fn();
    tm.onAskUserTimeout = timeoutSpy;

    // LLM mistakenly tagged 'Delete' as safe; heuristic must override to 'Keep'
    const promise = askUserTool.invoke({
      question: 'unused file?',
      options: [
        { label: 'Delete it', value: 'delete', isSafeDefault: true },
        { label: 'Keep it', value: 'keep' },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('"Keep it"');
    expect(result).toContain('value: keep');
    expect(result).toContain('picked by heuristic');
    expect(timeoutSpy).toHaveBeenCalledWith(threadId, 'keep');
  });

  it('heuristic picks safe no-op when no explicit isSafeDefault set', async () => {
    const promise = askUserTool.invoke({
      question: 'retry or skip?',
      options: [
        { label: 'Retry now', value: 'retry' },
        { label: 'Skip this step', value: 'skip' },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('"Skip this step"');
    expect(result).toContain('picked by heuristic');
  });

  it('heuristic works on Chinese safe keywords', async () => {
    const promise = askUserTool.invoke({
      question: '覆盖还是保留？',
      options: [
        { label: '覆盖文件', value: 'overwrite' },
        { label: '保留原文件', value: 'keep' },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('"保留原文件"');
    expect(result).toContain('picked by heuristic');
  });

  it('all options destructive → no auto-select, echoes with hard constraint', async () => {
    const promise = askUserTool.invoke({
      question: 'delete or overwrite?',
      options: [
        { label: 'Delete existing', value: 'delete', isSafeDefault: true },
        { label: 'Overwrite everything', value: 'overwrite' },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    expect(result).toContain('Timeout on question');
    expect(result).toContain('DO NOT re-invoke ask_user');
    expect(result).not.toContain('Auto-fallback');
  });

  it('multiple isSafeDefault tags → unreliable, falls through to heuristic or echo', async () => {
    const promise = askUserTool.invoke({
      question: 'pick one',
      options: [
        { label: 'Apple', value: 'apple', isSafeDefault: true },
        { label: 'Banana', value: 'banana', isSafeDefault: true },
      ],
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    const result = await promise;

    // No safe no-op keywords → falls to echo branch
    expect(result).toContain('Timeout on question "pick one"');
    expect(result).not.toContain('Auto-fallback');
  });

  it('subsequent ask_user in same session short-circuits without blocking', async () => {
    // First call times out
    const first = askUserTool.invoke({ question: 'q1' });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await first;

    // Second call returns immediately (no advanceTimers needed)
    const second = await askUserTool.invoke({ question: 'q2' });
    expect(second).toContain('User is unresponsive this session');
    expect(second).toContain('Do not invoke ask_user again');
  });

  it('clears timeout when user responds in time', async () => {
    const timeoutSpy = vi.fn();
    tm.onAskUserTimeout = timeoutSpy;

    const promise = askUserTool.invoke({ question: 'pick one' });
    await vi.advanceTimersByTimeAsync(1000);
    tm.respondToAskUser(threadId, 'my answer');

    const result = await promise;
    expect(result).toBe('my answer');

    // Advancing past timeout must not double-resolve or fire onAskUserTimeout
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('cleans up pending ask_user on deleteThread', async () => {
    const promise = askUserTool.invoke({ question: 'pick one' });
    tm.deleteThread(threadId);

    const result = await promise;
    expect(result).toBe('[Thread deleted]');

    // Subsequent timer tick must be a no-op
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });
});
