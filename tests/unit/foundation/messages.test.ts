import { describe, it, expect } from 'vitest';
import {
  createTextContent,
  createUserMessage,
  createAssistantMessage,
  createToolMessage,
  extractToolUses,
} from '@/foundation/messages';

describe('Message Types', () => {
  describe('Content creation helpers', () => {
    it('creates TextContent', () => {
      const content = createTextContent('hello');
      expect(content).toEqual({ type: 'text', text: 'hello' });
    });
  });

  describe('Message creation helpers', () => {
    it('creates UserMessage with text', () => {
      const msg = createUserMessage('hello');
      expect(msg.role).toBe('user');
      expect(msg.content).toHaveLength(1);
      expect(msg.content[0]).toEqual({ type: 'text', text: 'hello' });
    });

    it('creates AssistantMessage with mixed content', () => {
      const msg = createAssistantMessage([
        { type: 'thinking', thinking: 'hmm...' },
        { type: 'text', text: 'here is my answer' },
        { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
      ]);
      expect(msg.role).toBe('assistant');
      expect(msg.content).toHaveLength(3);
    });

    it('creates ToolMessage', () => {
      const msg = createToolMessage('t1', 'file contents here');
      expect(msg.role).toBe('tool');
      expect(msg.content[0]).toEqual({
        type: 'tool_result',
        toolUseId: 't1',
        content: 'file contents here',
        isError: false,
      });
    });
  });

  describe('extractToolUses', () => {
    it('extracts tool_use blocks from AssistantMessage', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'I will read the file' },
        { type: 'tool_use', id: 't1', name: 'read_file', input: { path: '/a.ts' } },
        { type: 'tool_use', id: 't2', name: 'bash', input: { command: 'ls' } },
      ]);
      const toolUses = extractToolUses(msg);
      expect(toolUses).toHaveLength(2);
      expect(toolUses[0].name).toBe('read_file');
      expect(toolUses[1].name).toBe('bash');
    });

    it('returns empty array when no tool_use', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'done' },
      ]);
      expect(extractToolUses(msg)).toHaveLength(0);
    });
  });
});
