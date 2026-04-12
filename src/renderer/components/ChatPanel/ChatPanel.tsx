import React from 'react';
import { MessageHistory } from './MessageHistory';

interface Message {
  role: string;
  content: Array<{ type: string; [key: string]: any }>;
}

export function ChatPanel({ title, messages, streamingText, isStreaming = false, children }: {
  title: string;
  messages: Message[];
  streamingText?: string;
  isStreaming?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel chat-panel">
      <div className="chat-header">{title}</div>
      <MessageHistory messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
      {children}
    </div>
  );
}
