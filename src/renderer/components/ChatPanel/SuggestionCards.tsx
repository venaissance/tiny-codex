import React from 'react';

/**
 * Extract follow-up suggestions from the last assistant message.
 * Strategy:
 * 1. Find questions in the text (Chinese and English patterns)
 * 2. If no questions, generate context-aware suggestions based on tools used
 */
export function extractSuggestions(text: string, toolNames: string[]): string[] {
  if (text.length < 20) return [];

  const suggestions: string[] = [];

  // 1. Extract questions from text
  const questionPatterns = [
    /(?:Would you like|Do you want|Should I|Shall I|Want me to)[^.?!]*\?/gi,
    /(?:需要|要不要|是否|可以帮你)[^。？！]*[？?]/g,
  ];
  for (const pattern of questionPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        const clean = m.trim();
        if (clean.length > 5 && clean.length < 80) suggestions.push(clean);
      }
    }
  }

  if (suggestions.length > 0) return suggestions.slice(0, 3);

  // 2. Generate context-based suggestions from tool usage
  const toolSet = new Set(toolNames);

  if (toolSet.has('write_file')) {
    suggestions.push('Review and improve the file');
    suggestions.push('Add more details');
  }
  if (toolSet.has('bash')) {
    suggestions.push('Run it again with different params');
  }
  if (toolSet.has('read_file')) {
    suggestions.push('Summarize what you found');
  }
  if (toolSet.has('str_replace')) {
    suggestions.push('Show me the full updated file');
  }

  if (suggestions.length === 0 && text.length > 50) {
    suggestions.push('Tell me more');
    suggestions.push('Can you improve this?');
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
