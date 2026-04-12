import { describe, it, expect, vi } from 'vitest';
import { Model } from '@/foundation/models/model';
import type { ModelProvider } from '@/foundation/models/provider';
import type { AssistantMessage } from '@/foundation/messages/types';

describe('Model', () => {
  const mockResponse: AssistantMessage = {
    role: 'assistant',
    content: [{ type: 'text', text: 'hello' }],
  };

  function createMockProvider(): ModelProvider {
    return {
      invoke: vi.fn().mockResolvedValue(mockResponse),
    };
  }

  it('invokes provider with correct params', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider);

    const result = await model.invoke({
      prompt: 'You are helpful.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    expect(result).toEqual(mockResponse);
    expect(provider.invoke).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
      tools: undefined,
      options: undefined,
    });
  });

  it('passes model options to provider', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider, { temperature: 0, max_tokens: 4096 });

    await model.invoke({ prompt: 'test', messages: [] });

    expect(provider.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { temperature: 0, max_tokens: 4096 },
      }),
    );
  });

  it('omits system message when prompt is empty', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider);

    await model.invoke({ prompt: '', messages: [] });

    const call = (provider.invoke as any).mock.calls[0][0];
    expect(call.messages).toEqual([]);
  });
});
