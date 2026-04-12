import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../../fixtures/mock-provider';
import { z } from 'zod';
import type { AssistantMessage } from '@/foundation/messages/types';

describe('Agent', () => {
  function createTextResponse(text: string): AssistantMessage {
    return { role: 'assistant', content: [{ type: 'text', text }] };
  }

  function createToolCallResponse(toolName: string, input: Record<string, unknown>): AssistantMessage {
    return {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: `call-${Date.now()}-${Math.random()}`, name: toolName, input },
      ],
    };
  }

  describe('stream()', () => {
    it('returns assistant message when no tool calls', async () => {
      const provider = new MockModelProvider([createTextResponse('Hello!')]);
      const model = new Model('test', provider);
      const agent = new Agent({ model, prompt: 'You are helpful.' });

      const messages = [];
      for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
    });

    it('executes tool and continues loop', async () => {
      const provider = new MockModelProvider([
        createToolCallResponse('echo', { message: 'hello' }),
        createTextResponse('Done!'),
      ]);
      const model = new Model('test', provider);
      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo',
        parameters: z.object({ message: z.string() }),
        invoke: async ({ message }) => message,
      });
      const agent = new Agent({ model, prompt: 'test', tools: [echoTool] });

      const messages = [];
      for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'echo hello' }] })) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('assistant');
      expect(messages[1].role).toBe('tool');
      expect(messages[2].role).toBe('assistant');
    });

    it('respects maxSteps limit', async () => {
      const infiniteToolCalls = Array.from({ length: 10 }, () =>
        createToolCallResponse('echo', { message: 'loop' }),
      );
      const provider = new MockModelProvider(infiniteToolCalls);
      const model = new Model('test', provider);
      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo',
        parameters: z.object({ message: z.string() }),
        invoke: async ({ message }) => message,
      });
      const agent = new Agent({ model, prompt: 'test', tools: [echoTool], maxSteps: 3 });

      await expect(async () => {
        for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'loop' }] })) {
          // consume
        }
      }).rejects.toThrow(/max steps/i);
    });
  });
});
