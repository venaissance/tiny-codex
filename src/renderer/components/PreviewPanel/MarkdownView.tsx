import React, { useState, useEffect, useRef } from 'react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { cjk } from '@streamdown/cjk';

/**
 * Simulates LLM-speed streaming: ~30 chars per tick at 30fps (~900 chars/sec).
 * Feels like reading a fast human typist. Auto-scrolls to bottom as content grows.
 */
function useStreamReveal(content: string, animated: boolean, scrollRef: React.RefObject<HTMLDivElement | null>) {
  const [revealed, setRevealed] = useState(animated ? '' : content);
  const timerRef = useRef<ReturnType<typeof setInterval>>(0 as any);

  useEffect(() => {
    if (!animated || !content) {
      setRevealed(content);
      return;
    }

    setRevealed('');
    let idx = 0;
    const CHARS_PER_TICK = 30;  // ~900 chars/sec at 30fps — comfortable reading pace
    const TICK_MS = 33;          // ~30fps

    timerRef.current = setInterval(() => {
      idx += CHARS_PER_TICK;
      if (idx >= content.length) {
        setRevealed(content);
        clearInterval(timerRef.current);
      } else {
        // Snap to next whitespace to avoid breaking mid-word
        const nextSpace = content.indexOf(' ', idx);
        idx = nextSpace > 0 ? nextSpace : idx;
        setRevealed(content.slice(0, idx));
      }
      // Auto-scroll to bottom
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, TICK_MS);

    return () => clearInterval(timerRef.current);
  }, [content, animated, scrollRef]);

  return revealed;
}

export function MarkdownView({ content, animated = false }: { content: string; basePath?: string; animated?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayed = useStreamReveal(content, animated, scrollRef);

  // Auto-scroll preview to bottom when content grows (live streaming preview)
  const prevLenRef = useRef(0);
  useEffect(() => {
    if (!animated && content.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLenRef.current = content.length;
  }, [content, animated]);

  return (
    <div ref={scrollRef} style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      <Streamdown
        plugins={{ code, math, mermaid, cjk }}
      >
        {displayed}
      </Streamdown>
    </div>
  );
}
