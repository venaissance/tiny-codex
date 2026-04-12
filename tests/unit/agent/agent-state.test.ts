import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../../fixtures/mock-provider';
import { z } from 'zod';
import type { AssistantMessage } from '@/foundation/messages/types';
import type { AgentStateEvent } from '@/agent/trajectory';

describe('Agent state changes', () => {
  function createTextResponse(text: string): AssistantMessage {
    return { role: 'assistant', content: [{ type: 'text', text }] };
  }

  function createToolCallResponse(toolName: string, input: Record<string, unknown>): AssistantMessage {
    return {
      role: 'assistant',
      content: [{ type: 'tool_use', id: `call-${Date.now()}`, name: toolName, input }],
    };
  }

  it('emits thinking → completed for text-only response', async () => {
    const states: AgentStateEvent[] = [];
    const provider = new MockModelProvider([createTextResponse('Hello!')]);
    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'test',
      threadId: 'thread-t1',
      onStateChange: (e) => states.push(e),
    });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {
      // consume
    }

    expect(states).toHaveLength(2);
    expect(states[0]).toMatchObject({ state: 'thinking', step: 1, threadId: 'thread-t1' });
    expect(states[1]).toMatchObject({ state: 'completed', step: 1 });
  });

  it('emits thinking → tool_calling → thinking → completed for tool use', async () => {
    const states: AgentStateEvent[] = [];
    const provider = new MockModelProvider([
      createToolCallResponse('echo', { message: 'hi' }),
      createTextResponse('Done'),
    ]);
    const model = new Model('test', provider);
    const echoTool = defineTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ message: z.string() }),
      invoke: async ({ message }) => message,
    });
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [echoTool],
      threadId: 'thread-t2',
      onStateChange: (e) => states.push(e),
    });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'echo hi' }] })) {
      // consume
    }

    // Step 1: thinking, tool_calling
    // Step 2: thinking, completed
    expect(states.length).toBeGreaterThanOrEqual(4);
    expect(states[0]).toMatchObject({ state: 'thinking', step: 1 });
    expect(states[1]).toMatchObject({ state: 'tool_calling', step: 1, toolName: 'echo' });
    expect(states[2]).toMatchObject({ state: 'thinking', step: 2 });
    expect(states[3]).toMatchObject({ state: 'completed', step: 2 });
  });

  it('records trajectory with tool call details', async () => {
    const provider = new MockModelProvider([
      createToolCallResponse('echo', { message: 'test' }),
      createTextResponse('Done'),
    ]);
    const model = new Model('test', provider);
    const echoTool = defineTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ message: z.string() }),
      invoke: async ({ message }) => message,
    });
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [echoTool],
      threadId: 'thread-t3',
    });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'test' }] })) {
      // consume
    }

    const trajectory = agent.getLastTrajectory();
    expect(trajectory).not.toBeNull();
    expect(trajectory!.success).toBe(true);
    expect(trajectory!.threadId).toBe('thread-t3');
    expect(trajectory!.totalSteps).toBe(2);
    expect(trajectory!.steps[0].toolCalls).toHaveLength(1);
    expect(trajectory!.steps[0].toolCalls[0].name).toBe('echo');
    expect(trajectory!.steps[0].toolCalls[0].result).toBe('test');
    expect(trajectory!.steps[0].toolCalls[0].isError).toBe(false);
    expect(trajectory!.steps[0].toolCalls[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records failed trajectory on max steps', async () => {
    const provider = new MockModelProvider(
      Array.from({ length: 5 }, () => createToolCallResponse('echo', { message: 'loop' })),
    );
    const model = new Model('test', provider);
    const echoTool = defineTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ message: z.string() }),
      invoke: async ({ message }) => message,
    });
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [echoTool],
      maxSteps: 2,
      threadId: 'thread-t4',
    });

    await expect(async () => {
      for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'loop' }] })) {
        // consume
      }
    }).rejects.toThrow(/max steps/i);

    const trajectory = agent.getLastTrajectory();
    expect(trajectory).not.toBeNull();
    expect(trajectory!.success).toBe(false);
    expect(trajectory!.error).toMatch(/max steps/i);
  });
});
