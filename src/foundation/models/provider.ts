import type { Message, AssistantMessage } from '../messages/types';
import type { FunctionTool } from '../tools/define-tool';

export interface ModelProvider {
  invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage>;
}
