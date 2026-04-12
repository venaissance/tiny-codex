import { describe, it, expect } from 'vitest';
import { Compactor } from '@/agent/compaction/compactor';
import { createUserMessage, createAssistantMessage } from '@/foundation/messages';
import type { NonSystemMessage } from '@/foundation/messages/types';

describe('Compactor', () => {
  describe('shouldCompact', () => {
    it('returns false when messages are short', () => {
      const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });
      const messages: NonSystemMessage[] = [
        createUserMessage('hello'),
        createAssistantMessage([{ type: 'text', text: 'hi' }]),
      ];
      expect(compactor.shouldCompact(messages)).toBe(false);
    });

    it('returns true when estimated tokens exceed threshold', () => {
      const compactor = new Compactor({ contextWindow: 100, maxOutputTokens: 20, bufferTokens: 10 });
      const longText = 'a'.repeat(300);
      const messages: NonSystemMessage[] = [createUserMessage(longText)];
      expect(compactor.shouldCompact(messages)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('estimates tokens from message content', () => {
      const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });
      const messages: NonSystemMessage[] = [createUserMessage('hello world')];
      const estimate = compactor.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(100);
    });
  });
});
