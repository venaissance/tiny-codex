import React, { useState } from 'react';

export function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`msg-thinking${expanded ? '' : ' collapsed'}`}
    >
      {thinking}
    </div>
  );
}
