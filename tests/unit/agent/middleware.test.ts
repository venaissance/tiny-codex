import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../../fixtures/mock-provider';
import type { AgentMiddleware } from '@/agent/middleware';
import { z } from 'zod';

describe('Agent Middleware', () => {
  const textResponse = { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'done' }] };

  it('calls lifecycle hooks in order', async () => {
    const order: string[] = [];
    const middleware: AgentMiddleware = {
      beforeAgentRun: async () => { order.push('beforeAgentRun'); },
      afterAgentRun: async () => { order.push('afterAgentRun'); },
      beforeAgentStep: async () => { order.push('beforeAgentStep'); },
      beforeModel: async () => { order.push('beforeModel'); },
      afterModel: async () => { order.push('afterModel'); },
    };

    const provider = new MockModelProvider([textResponse]);
    const model = new Model('test', provider);
    const agent = new Agent({ model, prompt: 'test', middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {}

    expect(order).toEqual([
      'beforeAgentRun',
      'beforeAgentStep',
      'beforeModel',
      'afterModel',
      'afterAgentRun',
    ]);
  });

  it('beforeModel can modify prompt', async () => {
    const middleware: AgentMiddleware = {
      beforeModel: async (context) => {
        return { prompt: context.prompt + '\nExtra instruction' };
      },
    };

    const provider = new MockModelProvider([textResponse]);
    const model = new Model('test', provider);
    const agent = new Agent({ model, prompt: 'base', middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {}

    const systemMsg = provider.invocations[0].messages[0] as any;
    expect(systemMsg.content[0].text).toContain('Extra instruction');
  });

  it('beforeToolUse and afterToolUse are called', async () => {
    const calls: string[] = [];
    const middleware: AgentMiddleware = {
      beforeToolUse: async (toolUse) => { calls.push(`before:${toolUse.name}`); },
      afterToolUse: async (toolUse, result) => { calls.push(`after:${toolUse.name}:${result}`); },
    };

    const provider = new MockModelProvider([
      { role: 'assistant', content: [
        { type: 'tool_use', id: 't1', name: 'echo', input: { message: 'hi' } },
      ]},
      textResponse,
    ]);
    const model = new Model('test', provider);
    const echoTool = defineTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ message: z.string() }),
      invoke: async ({ message }) => message,
    });
    const agent = new Agent({ model, prompt: 'test', tools: [echoTool], middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'go' }] })) {}

    expect(calls).toEqual(['before:echo', 'after:echo:hi']);
  });
});
