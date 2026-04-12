import React from 'react';

export function ToolCallBlock({ name, input }: { name: string; input: Record<string, any> }) {
  return (
    <div className="msg-tool">
      <div className="msg-tool-label">{name}</div>
      <div>{JSON.stringify(input, null, 2)}</div>
    </div>
  );
}
