// ===== Content Types =====

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type Content =
  | TextContent
  | ImageContent
  | ThinkingContent
  | ToolUseContent
  | ToolResultContent;

// ===== Message Types =====

export interface SystemMessage {
  role: 'system';
  content: TextContent[];
}

export interface UserMessage {
  role: 'user';
  content: (TextContent | ImageContent)[];
}

export interface AssistantMessage {
  role: 'assistant';
  content: (TextContent | ThinkingContent | ToolUseContent)[];
}

export interface ToolMessage {
  role: 'tool';
  content: ToolResultContent[];
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;
export type NonSystemMessage = UserMessage | AssistantMessage | ToolMessage;

// ===== Helpers =====

export function createTextContent(text: string): TextContent {
  return { type: 'text', text };
}

export function createUserMessage(text: string): UserMessage {
  return { role: 'user', content: [createTextContent(text)] };
}

export function createAssistantMessage(
  content: AssistantMessage['content'],
): AssistantMessage {
  return { role: 'assistant', content };
}

export function createToolMessage(
  toolUseId: string,
  result: string,
  isError = false,
): ToolMessage {
  return {
    role: 'tool',
    content: [{ type: 'tool_result', toolUseId, content: result, isError }],
  };
}

export function extractToolUses(msg: AssistantMessage): ToolUseContent[] {
  return msg.content.filter(
    (c): c is ToolUseContent => c.type === 'tool_use',
  );
}
