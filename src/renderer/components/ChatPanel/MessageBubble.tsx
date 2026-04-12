import React from 'react';

export function MessageBubble({ text }: { text: string }) {
  return (
    <div className="msg-user">{text}</div>
  );
}
