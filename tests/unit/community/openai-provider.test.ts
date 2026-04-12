import { describe, it, expect } from 'vitest';
import { OpenAIModelProvider } from '@/community/openai/provider';

describe('OpenAIModelProvider', () => {
  it('normalizes baseURL trailing slashes', () => {
    const p1 = new OpenAIModelProvider({ apiKey: 'k', baseURL: 'https://api.example.com/v1/' });
    const p2 = new OpenAIModelProvider({ apiKey: 'k', baseURL: 'https://api.example.com/v1///' });
    const p3 = new OpenAIModelProvider({ apiKey: 'k', baseURL: 'https://api.example.com/v1' });

    // All should produce the same normalized URL (no trailing slash)
    expect((p1 as any).baseURL).toBe('https://api.example.com/v1');
    expect((p2 as any).baseURL).toBe('https://api.example.com/v1');
    expect((p3 as any).baseURL).toBe('https://api.example.com/v1');
  });

  it('defaults baseURL to OpenAI', () => {
    const p = new OpenAIModelProvider({ apiKey: 'k' });
    expect((p as any).baseURL).toBe('https://api.openai.com/v1');
  });

  it('stores defaultOptions', () => {
    const p = new OpenAIModelProvider({
      apiKey: 'k',
      defaultOptions: { reasoning_split: true, temperature: 0.7 },
    });
    expect((p as any).defaultOptions).toEqual({ reasoning_split: true, temperature: 0.7 });
  });

  it('defaults supportsStreaming to true', () => {
    const p = new OpenAIModelProvider({ apiKey: 'k' });
    expect(p.supportsStreaming).toBe(true);
  });

  it('respects supportsStreaming = false', () => {
    const p = new OpenAIModelProvider({ apiKey: 'k', supportsStreaming: false });
    expect(p.supportsStreaming).toBe(false);
  });
});
