import type { Message, AssistantMessage } from '../../foundation/messages/types';

export function convertToAnthropicMessages(messages: Message[]): any[] {
  return messages.flatMap((msg): any[] => {
    switch (msg.role) {
      case 'system':
        return [];

      case 'user':
        return [{ role: 'user', content: msg.content }];

      case 'assistant':
        return [{ role: 'assistant', content: msg.content }];

      case 'tool':
        return [{
          role: 'user',
          content: msg.content.map((c) => ({
            type: 'tool_result',
            tool_use_id: c.toolUseId,
            content: c.content,
            ...(c.isError ? { is_error: true } : {}),
          })),
        }];
    }
  });
}

export function extractSystemPrompt(messages: Message[]): string | undefined {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  if (systemMsgs.length === 0) return undefined;
  return systemMsgs
    .flatMap((m) => m.content)
    .map((c) => c.text)
    .join('\n');
}

export function parseAnthropicResponse(response: {
  content: Array<{
    type: string;
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
}): AssistantMessage {
  const content: AssistantMessage['content'] = response.content.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text' as const, text: block.text! };
      case 'thinking':
        return { type: 'thinking' as const, thinking: block.thinking! };
      case 'tool_use':
        return {
          type: 'tool_use' as const,
          id: block.id!,
          name: block.name!,
          input: block.input!,
        };
      default:
        return { type: 'text' as const, text: `[unknown block: ${block.type}]` };
    }
  });

  return { role: 'assistant', content };
}
