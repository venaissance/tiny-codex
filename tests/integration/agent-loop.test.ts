import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createUserMessage } from '@/foundation/messages';
import { z } from 'zod';

describe('Agent Loop Integration', () => {
  it('complete flow: user asks → agent reads file → agent responds', async () => {
    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'I need to check the file first' },
          { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'test.txt' } },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The file contains: hello world' }],
      },
    ]);

    const model = new Model('test-model', provider);
    const readFileTool = defineTool({
      name: 'read_file',
      description: 'Read a file',
      parameters: z.object({ path: z.string() }),
      invoke: async () => 'hello world',
    });

    const agent = new Agent({
      model,
      prompt: 'You are a coding assistant.',
      tools: [readFileTool],
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('What is in test.txt?'))) {
      messages.push(msg);
    }

    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('assistant');
    expect(messages[1].role).toBe('tool');
    expect(messages[2].role).toBe('assistant');
    expect(messages[1].content[0].content).toBe('hello world');
    expect(provider.invocations).toHaveLength(2);
  });

  it('agent handles tool errors gracefully', async () => {
    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'bash', input: { command: 'bad-cmd' } }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The command failed.' }],
      },
    ]);

    const model = new Model('test', provider);
    const bashTool = defineTool({
      name: 'bash',
      description: 'Run command',
      parameters: z.object({ command: z.string() }),
      invoke: async () => { throw new Error('command not found'); },
    });

    const agent = new Agent({ model, prompt: 'test', tools: [bashTool] });
    const messages = [];
    for await (const msg of agent.stream(createUserMessage('run bad-cmd'))) {
      messages.push(msg);
    }

    expect(messages).toHaveLength(3);
    expect(messages[1].content[0].content).toContain('Error: command not found');
  });
});
