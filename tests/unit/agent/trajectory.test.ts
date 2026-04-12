import { describe, it, expect } from 'vitest';
import { TrajectoryRecorder } from '@/agent/trajectory';
import type { AssistantMessage } from '@/foundation/messages/types';

describe('TrajectoryRecorder', () => {
  const mockAssistantMsg: AssistantMessage = {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
  };

  it('records a single step and finalizes', () => {
    const recorder = new TrajectoryRecorder('thread-1');

    recorder.beginStep(1);
    recorder.recordAssistantMessage(mockAssistantMsg);
    recorder.endStep('completed');

    const trajectory = recorder.finalize(true);

    expect(trajectory.threadId).toBe('thread-1');
    expect(trajectory.success).toBe(true);
    expect(trajectory.totalSteps).toBe(1);
    expect(trajectory.steps[0].step).toBe(1);
    expect(trajectory.steps[0].state).toBe('completed');
    expect(trajectory.steps[0].assistantMessage).toEqual(mockAssistantMsg);
    expect(trajectory.steps[0].toolCalls).toEqual([]);
    expect(trajectory.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records tool calls within a step', () => {
    const recorder = new TrajectoryRecorder('thread-2');

    recorder.beginStep(1);
    recorder.recordAssistantMessage(mockAssistantMsg);
    recorder.recordToolCall({
      name: 'bash',
      input: { command: 'ls' },
      result: 'file.txt',
      durationMs: 50,
      isError: false,
    });
    recorder.recordToolCall({
      name: 'read_file',
      input: { path: '/tmp/x' },
      result: 'content',
      durationMs: 10,
      isError: false,
    });
    recorder.endStep('reflecting');

    const trajectory = recorder.finalize(true);

    expect(trajectory.steps[0].toolCalls).toHaveLength(2);
    expect(trajectory.steps[0].toolCalls[0].name).toBe('bash');
    expect(trajectory.steps[0].toolCalls[1].name).toBe('read_file');
    expect(trajectory.steps[0].state).toBe('reflecting');
  });

  it('records multiple steps', () => {
    const recorder = new TrajectoryRecorder('thread-3');

    recorder.beginStep(1);
    recorder.recordAssistantMessage(mockAssistantMsg);
    recorder.endStep('reflecting');

    recorder.beginStep(2);
    recorder.recordAssistantMessage(mockAssistantMsg);
    recorder.endStep('completed');

    const trajectory = recorder.finalize(true);

    expect(trajectory.totalSteps).toBe(2);
    expect(trajectory.steps[0].step).toBe(1);
    expect(trajectory.steps[1].step).toBe(2);
  });

  it('handles finalize with error', () => {
    const recorder = new TrajectoryRecorder('thread-4');

    recorder.beginStep(1);
    recorder.recordAssistantMessage(mockAssistantMsg);
    // Don't endStep — finalize should auto-close

    const trajectory = recorder.finalize(false, 'max steps exceeded');

    expect(trajectory.success).toBe(false);
    expect(trajectory.error).toBe('max steps exceeded');
    expect(trajectory.totalSteps).toBe(1);
    expect(trajectory.steps[0].state).toBe('error');
  });

  it('getSteps returns copy of recorded steps', () => {
    const recorder = new TrajectoryRecorder('thread-5');

    recorder.beginStep(1);
    recorder.recordAssistantMessage(mockAssistantMsg);
    recorder.endStep('completed');

    const steps = recorder.getSteps();
    expect(steps).toHaveLength(1);
    // Mutating returned array should not affect recorder
    steps.pop();
    expect(recorder.getSteps()).toHaveLength(1);
  });
});
