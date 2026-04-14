import React from 'react';

/**
 * Extract follow-up suggestions from the last assistant message.
 * Strategy:
 * 1. Find questions in the text (Chinese and English patterns)
 * 2. If no questions, generate context-aware suggestions based on tools used
 */
export function extractSuggestions(text: string, _toolNames: string[]): string[] {
  if (text.length < 20) return [];

  // Model-generated suggestions via HTML comment
  // Format: <!-- suggestions: ["action 1", "action 2", "action 3"] -->
  const commentMatch = text.match(/<!--\s*suggestions:\s*(\[[\s\S]*?\])\s*-->/);
  if (commentMatch) {
    try {
      const parsed = JSON.parse(commentMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((s: unknown) => typeof s === 'string' && s.length > 2).slice(0, 3);
      }
    } catch { /* malformed JSON — no suggestions */ }
  }

  return [];
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
