import type { NonSystemMessage } from '../messages/types';
import type { FunctionTool } from '../tools/define-tool';

export interface ModelContext {
  prompt: string;
  messages: NonSystemMessage[];
  tools?: FunctionTool<any, any>[];
}
