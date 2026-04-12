import type { Message, AssistantMessage } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';

// ===== Internal → OpenAI =====

export function convertToOpenAIMessages(messages: Message[]): any[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'system':
        return { role: 'system', content: msg.content.map((c) => c.text).join('\n') };

      case 'user': {
        const textParts = msg.content.filter((c) => c.type === 'text');
        return { role: 'user', content: textParts.map((c) => c.text).join('\n') };
      }

      case 'assistant': {
        const textParts = msg.content.filter((c) => c.type === 'text');
        const toolUses = msg.content.filter((c) => c.type === 'tool_use');
        const result: any = {
          role: 'assistant',
          content: textParts.map((c) => c.text).join('\n') || null,
        };
        if (toolUses.length > 0) {
          result.tool_calls = toolUses.map((t) => ({
            type: 'function',
            id: t.id,
            function: {
              name: t.name,
              arguments: JSON.stringify(t.input),
            },
          }));
        }
        return result;
      }

      case 'tool': {
        const r = msg.content[0];
        return {
          role: 'tool',
          tool_call_id: r.toolUseId,
          content: r.content,
        };
      }
    }
  });
}

// ===== OpenAI → Internal =====

export function parseOpenAIResponse(response: {
  role: 'assistant';
  content?: string | null;
  tool_calls?: Array<{
    type: 'function';
    id: string;
    function: { name: string; arguments: string };
  }>;
  reasoning_content?: string;
}): AssistantMessage {
  const content: AssistantMessage['content'] = [];

  if (response.reasoning_content) {
    content.push({ type: 'thinking', thinking: response.reasoning_content });
  }

  if (response.content) {
    content.push({ type: 'text', text: response.content });
  }

  if (response.tool_calls) {
    for (const tc of response.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      });
    }
  }

  return { role: 'assistant', content };
}

// ===== Tools → OpenAI =====

export function convertToOpenAITools(tools: FunctionTool<any, any>[]): any[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.toJSONSchema(),
    },
  }));
}
