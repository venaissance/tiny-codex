import type { ModelProvider } from '@/foundation/models/provider';
import type { AssistantMessage } from '@/foundation/messages/types';

/**
 * MockModelProvider for testing Agent without real API calls.
 * Provide a sequence of responses; it returns them in order.
 */
export class MockModelProvider implements ModelProvider {
  private responses: AssistantMessage[];
  private callIndex = 0;
  public invocations: Array<{ model: string; messages: unknown[]; tools?: unknown[] }> = [];

  constructor(responses: AssistantMessage[]) {
    this.responses = responses;
  }

  async invoke(params: {
    model: string;
    messages: unknown[];
    tools?: unknown[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    this.invocations.push({
      model: params.model,
      messages: params.messages as unknown[],
      tools: params.tools,
    });
    if (this.callIndex >= this.responses.length) {
      throw new Error(
        `MockModelProvider: no more responses (called ${this.callIndex + 1} times, only ${this.responses.length} responses)`,
      );
    }
    return this.responses[this.callIndex++];
  }
}
