import type { ModelProvider } from '../../foundation/models/provider';
import type { Message, AssistantMessage } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';
import { convertToAnthropicMessages, extractSystemPrompt, parseAnthropicResponse } from './converter';

export type StreamCallback = (event: StreamEvent) => void;

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; partialJson: string }
  | { type: 'content_block_stop' }
  | { type: 'message_stop' };

export class AnthropicModelProvider implements ModelProvider {
  private apiKey: string;
  private baseURL: string;
  public onStream?: StreamCallback;

  constructor(config: { apiKey: string; baseURL?: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? 'https://api.anthropic.com';
  }

  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    const system = extractSystemPrompt(params.messages);
    const nonSystemMessages = params.messages.filter((m) => m.role !== 'system');

    const body: any = {
      model: params.model,
      messages: convertToAnthropicMessages(nonSystemMessages),
      max_tokens: 8192,
      stream: true,
      ...params.options,
    };

    if (system) {
      body.system = system;
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.toJSONSchema(),
      }));
    }

    const url = this.baseURL.endsWith('/v1/messages')
      ? this.baseURL
      : `${this.baseURL.replace(/\/$/, '')}/v1/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    }

    // Parse SSE stream
    const content: AssistantMessage['content'] = [];
    let currentText = '';
    let currentThinking = '';
    let currentToolId = '';
    let currentToolName = '';
    let currentToolJson = '';

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

        let event: any;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        const eventType = event.type;

        if (eventType === 'content_block_start') {
          const block = event.content_block;
          if (block?.type === 'tool_use') {
            currentToolId = block.id;
            currentToolName = block.name;
            currentToolJson = '';
          }
        } else if (eventType === 'content_block_delta') {
          const delta = event.delta;
          if (delta?.type === 'text_delta') {
            currentText += delta.text;
            this.onStream?.({ type: 'text_delta', text: delta.text });
          } else if (delta?.type === 'thinking_delta') {
            currentThinking += delta.thinking;
            this.onStream?.({ type: 'thinking_delta', thinking: delta.thinking });
          } else if (delta?.type === 'input_json_delta') {
            currentToolJson += delta.partial_json;
            this.onStream?.({ type: 'tool_use_delta', partialJson: delta.partial_json });
          }
        } else if (eventType === 'content_block_stop') {
          // Flush current block
          if (currentThinking) {
            content.push({ type: 'thinking', thinking: currentThinking });
            currentThinking = '';
          }
          if (currentText) {
            content.push({ type: 'text', text: currentText });
            currentText = '';
          }
          if (currentToolName) {
            let input = {};
            try { input = JSON.parse(currentToolJson); } catch {}
            content.push({
              type: 'tool_use',
              id: currentToolId,
              name: currentToolName,
              input,
            });
            currentToolId = '';
            currentToolName = '';
            currentToolJson = '';
          }
          this.onStream?.({ type: 'content_block_stop' });
        } else if (eventType === 'message_stop') {
          this.onStream?.({ type: 'message_stop' });
        }
      }
    }

    // Flush any remaining content
    if (currentThinking) content.push({ type: 'thinking', thinking: currentThinking });
    if (currentText) content.push({ type: 'text', text: currentText });
    if (currentToolName) {
      let input = {};
      try { input = JSON.parse(currentToolJson); } catch {}
      content.push({ type: 'tool_use', id: currentToolId, name: currentToolName, input });
    }

    return { role: 'assistant', content };
  }
}
