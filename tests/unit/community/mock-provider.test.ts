import { describe, it, expect } from 'vitest';
import { MockModelProvider } from '@/community/mock/provider';
import type { StreamEvent } from '@/community/stream-types';

describe('MockModelProvider streaming', () => {
  it('emits text_delta events for text responses', async () => {
    const provider = new MockModelProvider();
    const events: StreamEvent[] = [];
    provider.onStream = (e) => events.push(e);

    await provider.invoke({
      model: 'test',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });

    const textDeltas = events.filter(e => e.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);
    // Concatenated text should match the response
    const fullText = textDeltas.map(e => (e as any).text).join('');
    expect(fullText).toContain('[Mock]');
  });

  it('emits tool_use_start and tool_use_delta for write_file', async () => {
    const provider = new MockModelProvider();
    const events: StreamEvent[] = [];
    provider.onStream = (e) => events.push(e);

    const mockTool = {
      name: 'write_file',
      description: 'Write a file',
      toJSONSchema: () => ({}),
      invoke: async () => 'done',
    } as any;

    await provider.invoke({
      model: 'test',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'write a file' }] }],
      tools: [mockTool],
    });

    const starts = events.filter(e => e.type === 'tool_use_start');
    const deltas = events.filter(e => e.type === 'tool_use_delta');
    const stops = events.filter(e => e.type === 'content_block_stop');

    expect(starts).toHaveLength(1);
    expect((starts[0] as any).name).toBe('write_file');
    expect(deltas.length).toBeGreaterThan(0);
    expect(stops).toHaveLength(1);
  });

  it('does not emit events when onStream is not set', async () => {
    const provider = new MockModelProvider();
    // No onStream set — should not throw
    const result = await provider.invoke({
      model: 'test',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });
    expect(result.role).toBe('assistant');
  });

  it('has supportsStreaming = true', () => {
    const provider = new MockModelProvider();
    expect(provider.supportsStreaming).toBe(true);
  });
});
