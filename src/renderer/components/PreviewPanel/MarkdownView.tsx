import React from 'react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { cjk } from '@streamdown/cjk';

export function MarkdownView({ content }: { content: string; basePath?: string }) {
  return (
    <div style={{ padding: 20 }}>
      <Streamdown
        mode="static"
        plugins={{ code, math, mermaid, cjk }}
      >
        {content}
      </Streamdown>
    </div>
  );
}
