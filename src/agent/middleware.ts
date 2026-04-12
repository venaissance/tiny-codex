import type { ModelContext } from '../foundation/models/context';
import type { AssistantMessage, ToolUseContent } from '../foundation/messages/types';

export interface AgentMiddleware {
  beforeAgentRun?(): Promise<Record<string, unknown> | void>;
  afterAgentRun?(): Promise<void>;
  beforeAgentStep?(step: number): Promise<void>;
  afterAgentStep?(step: number): Promise<void>;
  beforeModel?(context: ModelContext): Promise<Partial<ModelContext> | void>;
  afterModel?(message: AssistantMessage): Promise<AssistantMessage | void>;
  beforeToolUse?(toolUse: ToolUseContent): Promise<void>;
  afterToolUse?(toolUse: ToolUseContent, result: string): Promise<void>;
}
