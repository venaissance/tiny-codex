/** Shared stream event types for all model providers. */

export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; partialJson: string }
  | { type: 'content_block_stop' }
  | { type: 'message_stop' };

export type StreamCallback = (event: StreamEvent) => void;
