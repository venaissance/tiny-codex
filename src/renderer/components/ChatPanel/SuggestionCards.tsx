import React from 'react';

/**
 * Extract follow-up suggestions from the last assistant message.
 * Strategy:
 * 1. Find questions in the text (Chinese and English patterns)
 * 2. If no questions, generate context-aware suggestions based on tools used
 */
export function extractSuggestions(text: string, _toolNames: string[]): string[] {
  if (text.length < 20) return [];

  // 1. Model-generated suggestions via HTML comment (preferred)
  //    Format: <!-- suggestions: ["action 1", "action 2", "action 3"] -->
  const commentMatch = text.match(/<!--\s*suggestions:\s*(\[[\s\S]*?\])\s*-->/);
  if (commentMatch) {
    try {
      const parsed = JSON.parse(commentMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((s: unknown) => typeof s === 'string' && s.length > 2).slice(0, 3);
      }
    } catch { /* fall through to regex extraction */ }
  }

  // 2. Fallback: extract list items after a question prompt
  const suggestions: string[] = [];
  const promptListPattern = /(?:Would you like|Do you want|Should I|Shall I|Want me to|你想|需要我|要不要|是否|还需要|如果需要|比如|例如|可以考虑)[^]*$/gi;
  const promptMatch = text.match(promptListPattern);
  if (promptMatch) {
    const block = promptMatch[0];
    const items = block.match(/(?:^|\n)\s*(?:\d+[\.\)]\s*|[-*•]\s*).+/g);
    if (items) {
      for (const item of items) {
        let clean = item.replace(/^\s*(?:\d+[\.\)]\s*|[-*•]\s*)/, '').trim();
        clean = clean.replace(/\*\*/g, '');
        clean = clean.replace(/\s*[（(][^)）]*[)）]\s*/g, ' ').trim();
        clean = clean.replace(/[？?。.!]$/, '').trim();
        if (clean.length > 2 && clean.length < 80) suggestions.push(clean);
      }
    }
  }

  return suggestions.slice(0, 3);
}

export function SuggestionCards({ suggestions, onSelect, isStreaming = false }: {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isStreaming?: boolean;
}) {
  if (isStreaming || suggestions.length === 0) return null;

  const displayed = suggestions.slice(0, 3);

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      padding: '8px 0',
    }}>
      {displayed.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'var(--surface-bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
