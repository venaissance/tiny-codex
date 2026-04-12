import type { NonSystemMessage } from '../../foundation/messages/types';
import type { Model } from '../../foundation/models/model';
import { createUserMessage } from '../../foundation/messages';

export interface CompactorOptions {
  contextWindow: number;
  maxOutputTokens: number;
  bufferTokens?: number;
}

export class Compactor {
  private contextWindow: number;
  private maxOutputTokens: number;
  private bufferTokens: number;

  constructor(options: CompactorOptions) {
    this.contextWindow = options.contextWindow;
    this.maxOutputTokens = options.maxOutputTokens;
    this.bufferTokens = options.bufferTokens ?? 13000;
  }

  shouldCompact(messages: NonSystemMessage[]): boolean {
    const threshold = this.contextWindow - this.maxOutputTokens - this.bufferTokens;
    return this.estimateTokens(messages) > threshold;
  }

  estimateTokens(messages: NonSystemMessage[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      for (const content of msg.content) {
        if ('text' in content) totalChars += content.text.length;
        if ('thinking' in content) totalChars += content.thinking.length;
        if ('content' in content && typeof content.content === 'string') {
          totalChars += content.content.length;
        }
        if ('input' in content) totalChars += JSON.stringify(content.input).length;
      }
    }
    return Math.ceil(totalChars / 4);
  }

  async compact(
    messages: NonSystemMessage[],
    model: Model,
  ): Promise<NonSystemMessage[]> {
    const summaryPrompt = 'Summarize the following conversation concisely, preserving key decisions, file paths, and code changes. Output only the summary.';

    const conversationText = messages
      .map((m) => {
        const role = m.role;
        const text = m.content
          .map((c) => {
            if ('text' in c) return c.text;
            if ('thinking' in c) return '[thinking] ' + c.thinking;
            if ('content' in c && typeof c.content === 'string') return '[tool result] ' + c.content;
            if ('name' in c) return '[tool call: ' + c.name + ']';
            return '';
          })
          .join('\n');
        return role + ': ' + text;
      })
      .join('\n---\n');

    const summaryResponse = await model.invoke({
      prompt: summaryPrompt,
      messages: [createUserMessage(conversationText)],
    });

    const summaryText = summaryResponse.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return [
      createUserMessage('[Previous conversation summary]\n' + summaryText),
    ];
  }
}
