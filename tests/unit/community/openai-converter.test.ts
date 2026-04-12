import { describe, it, expect } from 'vitest';
import {
  convertToOpenAIMessages,
  parseOpenAIResponse,
} from '@/community/openai/converter';
import { createUserMessage, createAssistantMessage, createToolMessage } from '@/foundation/messages';

describe('OpenAI Converter', () => {
  describe('convertToOpenAIMessages', () => {
    it('converts UserMessage to OpenAI format', () => {
      const msg = createUserMessage('hello');
      const result = convertToOpenAIMessages([msg]);
      expect(result).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('converts AssistantMessage with tool_use to tool_calls', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'reading file' },
        { type: 'tool_use', id: 't1', name: 'read_file', input: { path: '/a.ts' } },
      ]);
      const result = convertToOpenAIMessages([msg]);
      expect(result[0].tool_calls).toHaveLength(1);
      expect(result[0].tool_calls[0]).toEqual({
        type: 'function',
        id: 't1',
        function: { name: 'read_file', arguments: '{"path":"/a.ts"}' },
      });
    });

    it('filters out thinking content', () => {
      const msg = createAssistantMessage([
        { type: 'thinking', thinking: 'let me think...' },
        { type: 'text', text: 'answer' },
      ]);
      const result = convertToOpenAIMessages([msg]);
      expect(result[0].content).toBe('answer');
    });

    it('converts ToolMessage to OpenAI tool response', () => {
      const msg = createToolMessage('t1', 'file contents');
      const result = convertToOpenAIMessages([msg]);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 't1',
        content: 'file contents',
      });
    });
  });

  describe('parseOpenAIResponse', () => {
    it('parses text-only response', () => {
      const msg = parseOpenAIResponse({
        role: 'assistant',
        content: 'hello',
      });
      expect(msg.content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('parses response with tool_calls', () => {
      const msg = parseOpenAIResponse({
        role: 'assistant',
        content: 'I will read the file',
        tool_calls: [{
          type: 'function',
          id: 't1',
          function: { name: 'read_file', arguments: '{"path":"/a.ts"}' },
        }],
      });
      expect(msg.content).toHaveLength(2);
      expect(msg.content[1]).toEqual({
        type: 'tool_use',
        id: 't1',
        name: 'read_file',
        input: { path: '/a.ts' },
      });
    });

    it('parses reasoning_content as thinking', () => {
      const msg = parseOpenAIResponse({
        role: 'assistant',
        content: 'answer',
        reasoning_content: 'let me reason...',
      });
      expect(msg.content[0]).toEqual({ type: 'thinking', thinking: 'let me reason...' });
      expect(msg.content[1]).toEqual({ type: 'text', text: 'answer' });
    });
  });
});
