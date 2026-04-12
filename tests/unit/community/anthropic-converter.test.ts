import { describe, it, expect } from 'vitest';
import {
  convertToAnthropicMessages,
  parseAnthropicResponse,
} from '@/community/anthropic/converter';
import { createUserMessage, createAssistantMessage, createToolMessage } from '@/foundation/messages';

describe('Anthropic Converter', () => {
  describe('convertToAnthropicMessages', () => {
    it('converts UserMessage — content blocks array', () => {
      const msg = createUserMessage('hello');
      const result = convertToAnthropicMessages([msg]);
      expect(result).toEqual([{
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
      }]);
    });

    it('converts ToolMessage to tool_result content block', () => {
      const msg = createToolMessage('t1', 'output');
      const result = convertToAnthropicMessages([msg]);
      expect(result[0]).toEqual({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't1', content: 'output' }],
      });
    });
  });

  describe('parseAnthropicResponse', () => {
    it('parses text + tool_use blocks', () => {
      const msg = parseAnthropicResponse({
        content: [
          { type: 'text', text: 'I will help' },
          { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
        ],
      });
      expect(msg.role).toBe('assistant');
      expect(msg.content).toHaveLength(2);
    });

    it('parses thinking blocks', () => {
      const msg = parseAnthropicResponse({
        content: [
          { type: 'thinking', thinking: 'let me reason...' },
          { type: 'text', text: 'answer' },
        ],
      });
      expect(msg.content[0]).toEqual({ type: 'thinking', thinking: 'let me reason...' });
    });
  });
});
