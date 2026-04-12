import type { ModelProvider } from '../../foundation/models/provider';
import type { Message, AssistantMessage } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';
import { convertToOpenAIMessages, parseOpenAIResponse, convertToOpenAITools } from './converter';

export class OpenAIModelProvider implements ModelProvider {
  private baseURL: string;
  private apiKey: string;

  constructor(config: { baseURL?: string; apiKey: string }) {
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.apiKey = config.apiKey;
  }

  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    const body: any = {
      model: params.model,
      messages: convertToOpenAIMessages(params.messages),
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

    const data = await response.json();
    return parseOpenAIResponse(data.choices[0].message);
  }
}
