import { describe, it, expect } from 'vitest';
import { Compactor } from '@/agent/compaction/compactor';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createUserMessage, createAssistantMessage } from '@/foundation/messages';
import type { NonSystemMessage } from '@/foundation/messages/types';

describe('Compaction Integration', () => {
  it('compacts long conversation into summary', async () => {
    const provider = new MockModelProvider([{
      role: 'assistant',
      content: [{ type: 'text', text: 'Summary: User asked about Button component. Agent added loading prop.' }],
    }]);
    const model = new Model('test', provider);
    const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });

    const messages: NonSystemMessage[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push(createUserMessage(`Question ${i}: ${'x'.repeat(100)}`));
      messages.push(createAssistantMessage([{ type: 'text', text: `Answer ${i}: ${'y'.repeat(200)}` }]));
    }

    const compacted = await compactor.compact(messages, model);

    expect(compacted).toHaveLength(1);
    expect(compacted[0].role).toBe('user');
    expect(compacted[0].content[0].text).toContain('Summary');
  });
});
