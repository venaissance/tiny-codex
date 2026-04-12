import type { AssistantMessage, Message } from '../messages/types';
import type { ModelProvider } from './provider';
import type { ModelContext } from './context';

export class Model {
  constructor(
    readonly name: string,
    readonly provider: ModelProvider,
    readonly options?: Record<string, unknown>,
  ) {}

  async invoke(context: ModelContext): Promise<AssistantMessage> {
    const messages: Message[] = [];

    if (context.prompt) {
      messages.push({
        role: 'system',
        content: [{ type: 'text', text: context.prompt }],
      });
    }

    messages.push(...context.messages);

    return this.provider.invoke({
      model: this.name,
      messages,
      tools: context.tools,
      options: this.options,
    });
  }
}
