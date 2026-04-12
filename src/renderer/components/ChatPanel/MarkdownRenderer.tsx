import React from 'react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { cjk } from '@streamdown/cjk';

/**
 * Full-featured Markdown renderer — exact same config as Streamdown Playground.
 * Plugins: Shiki code, KaTeX math, Mermaid diagrams, CJK support.
 * Supports: GFM tables, task lists, strikethrough, etc.
 */
export function MarkdownRenderer({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      caret={streaming ? 'block' : undefined}
      isAnimating={streaming}
      plugins={{ code, math, mermaid, cjk }}
    >
      {text}
    </Streamdown>
  );
}
