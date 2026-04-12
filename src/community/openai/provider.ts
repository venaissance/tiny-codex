import type { ModelProvider } from '../../foundation/models/provider';
import type { Message, AssistantMessage } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';
import { convertToOpenAIMessages, parseOpenAIResponse, convertToOpenAITools } from './converter';
import type { StreamCallback } from '../stream-types';

export class OpenAIModelProvider implements ModelProvider {
  private baseURL: string;
  private apiKey: string;
  private defaultOptions: Record<string, unknown>;
  public supportsStreaming: boolean;
  public onStream?: StreamCallback;

  constructor(config: {
    baseURL?: string;
    apiKey: string;
    defaultOptions?: Record<string, unknown>;
    supportsStreaming?: boolean;
  }) {
    this.baseURL = (config.baseURL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultOptions = config.defaultOptions ?? {};
    this.supportsStreaming = config.supportsStreaming ?? true;
  }

  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    const useStream = !!this.onStream && this.supportsStreaming;

    const body: any = {
      model: params.model,
      messages: convertToOpenAIMessages(params.messages),
      ...(useStream ? { stream: true } : {}),
      ...this.defaultOptions,
      ...params.options,
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = convertToOpenAITools(params.tools);
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
    }

    if (!useStream) {
      const data = await response.json();
      return parseOpenAIResponse(data.choices[0].message);
    }

    // Parse SSE stream
    let textContent = '';
    let reasoningContent = '';
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          textContent += delta.content;
          this.onStream?.({ type: 'text_delta', text: delta.content });
        }

        if (delta.reasoning_content) {
          reasoningContent += delta.reasoning_content;
          this.onStream?.({ type: 'thinking_delta', thinking: delta.reasoning_content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
              if (tc.function?.name) {
                this.onStream?.({ type: 'tool_use_start', id: tc.id || '', name: tc.function.name });
              }
            }
            const call = toolCalls.get(idx)!;
            if (tc.id) call.id = tc.id;
            if (tc.function?.name) call.name = tc.function.name;
            if (tc.function?.arguments) {
              call.arguments += tc.function.arguments;
              this.onStream?.({ type: 'tool_use_delta', partialJson: tc.function.arguments });
            }
          }
        }
      }
    }

    const content: AssistantMessage['content'] = [];
    if (reasoningContent) content.push({ type: 'thinking', thinking: reasoningContent });
    if (textContent) content.push({ type: 'text', text: textContent });
    for (const [, tc] of toolCalls) {
      let input = {};
      try { input = JSON.parse(tc.arguments); } catch {}
      content.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
    }

    return { role: 'assistant', content };
  }
}
