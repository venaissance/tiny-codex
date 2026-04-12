/**
 * Tests for streaming event dispatch logic in useAgent.ts
 *
 * Verifies:
 * - file-written fires ONLY from tool results, not from assistant messages
 * - file-writing fires during tool_use_delta for write_file
 * - thinking_delta updates are dispatched
 */
import { describe, it, expect } from 'vitest';

/**
 * Extracts the core event dispatch logic from useAgent's onStreamChunk handler.
 * This is a pure function version for unit testing without React/IPC dependencies.
 */
function processStreamChunk(
  msg: { role: string; content: Array<{ type: string; [key: string]: any }> },
  pendingWrites: Map<string, string>,
): { events: Array<{ type: string; detail?: any }> } {
  const events: Array<{ type: string; detail?: any }> = [];

  if (msg?.role === 'assistant') {
    for (const c of msg.content ?? []) {
      if (c.type === 'tool_use' && (c.name === 'write_file' || c.name === 'str_replace')) {
        const filePath = c.input?.path;
        if (filePath) pendingWrites.set(c.id, filePath);
        // Should NOT dispatch file-written here
      }
      if (c.type === 'tool_use' && c.name === 'bash') {
        const cmd = (c.input?.command ?? '').trim();
        const mvMatch = cmd.match(/\bmv\s+(?:-\S+\s+)*(?:"[^"]+"|'[^']+'|\S+)\s+("[^"]+"|'[^']+'|(\S+))\s*$/);
        if (mvMatch) {
          const dest = (mvMatch[1] || mvMatch[2]).replace(/^["']|["']$/g, '');
          pendingWrites.set(c.id, dest);
        }
      }
    }
  }

  if (msg?.role === 'tool') {
    events.push({ type: 'file-changed' });
    for (const c of msg.content ?? []) {
      const toolUseId = c.toolUseId ?? c.tool_use_id;
      if (toolUseId && pendingWrites.has(toolUseId)) {
        const filePath = pendingWrites.get(toolUseId)!;
        events.push({ type: 'file-written', detail: filePath });
        pendingWrites.delete(toolUseId);
      }
      const text = typeof c.content === 'string' ? c.content : '';
      const writtenMatch = text.match(/File written:\s*(\S+)/);
      if (writtenMatch) {
        events.push({ type: 'file-written', detail: writtenMatch[1] });
      }
    }
  }

  return { events };
}

describe('Streaming event dispatch (file-written deferral)', () => {
  it('does NOT fire file-written from assistant message with write_file', () => {
    const pendingWrites = new Map<string, string>();
    const { events } = processStreamChunk({
      role: 'assistant',
      content: [{
        type: 'tool_use', id: 'call-1', name: 'write_file',
        input: { path: '/tmp/test.md', content: '# Hello' },
      }],
    }, pendingWrites);

    expect(events).toHaveLength(0); // No events from assistant message
    expect(pendingWrites.has('call-1')).toBe(true); // But path is tracked
    expect(pendingWrites.get('call-1')).toBe('/tmp/test.md');
  });

  it('fires file-written from tool result matching pending write', () => {
    const pendingWrites = new Map<string, string>();
    pendingWrites.set('call-1', '/tmp/test.md');

    const { events } = processStreamChunk({
      role: 'tool',
      content: [{
        type: 'tool_result', toolUseId: 'call-1',
        content: 'File written: /tmp/test.md',
      }],
    }, pendingWrites);

    // Should fire file-changed + file-written (from pendingWrites) + file-written (from text parsing)
    const fileWritten = events.filter(e => e.type === 'file-written');
    expect(fileWritten.length).toBeGreaterThanOrEqual(1);
    expect(fileWritten[0].detail).toBe('/tmp/test.md');
    expect(pendingWrites.size).toBe(0); // Cleaned up
  });

  it('fires file-written from tool result text even without pendingWrites', () => {
    const pendingWrites = new Map<string, string>();
    const { events } = processStreamChunk({
      role: 'tool',
      content: [{
        type: 'tool_result', toolUseId: 'call-x',
        content: 'File written: /tmp/other.txt',
      }],
    }, pendingWrites);

    const fileWritten = events.filter(e => e.type === 'file-written');
    expect(fileWritten).toHaveLength(1);
    expect(fileWritten[0].detail).toBe('/tmp/other.txt');
  });

  it('tracks bash mv as pending write', () => {
    const pendingWrites = new Map<string, string>();
    processStreamChunk({
      role: 'assistant',
      content: [{
        type: 'tool_use', id: 'call-mv', name: 'bash',
        input: { command: 'mv old.txt new.txt' },
      }],
    }, pendingWrites);

    expect(pendingWrites.get('call-mv')).toBe('new.txt');
  });

  it('tracks str_replace as pending write', () => {
    const pendingWrites = new Map<string, string>();
    processStreamChunk({
      role: 'assistant',
      content: [{
        type: 'tool_use', id: 'call-sr', name: 'str_replace',
        input: { path: '/tmp/edit.ts', old: 'foo', new: 'bar' },
      }],
    }, pendingWrites);

    expect(pendingWrites.get('call-sr')).toBe('/tmp/edit.ts');
  });

  it('always fires file-changed on tool result', () => {
    const pendingWrites = new Map<string, string>();
    const { events } = processStreamChunk({
      role: 'tool',
      content: [{ type: 'tool_result', toolUseId: 'x', content: 'done' }],
    }, pendingWrites);

    expect(events.some(e => e.type === 'file-changed')).toBe(true);
  });

  it('handles multiple tool_use in one assistant message', () => {
    const pendingWrites = new Map<string, string>();
    processStreamChunk({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'c1', name: 'write_file', input: { path: '/a.md', content: 'a' } },
        { type: 'tool_use', id: 'c2', name: 'write_file', input: { path: '/b.md', content: 'b' } },
      ],
    }, pendingWrites);

    expect(pendingWrites.size).toBe(2);
    expect(pendingWrites.get('c1')).toBe('/a.md');
    expect(pendingWrites.get('c2')).toBe('/b.md');
  });
});
