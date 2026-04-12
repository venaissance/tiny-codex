import React from 'react';

export function Titlebar({ projectName, diffStats, onOpen, onCommit, onToggleTheme, theme }: {
  projectName: string | null;
  diffStats: { added: number; removed: number };
  onOpen: () => void;
  onCommit: () => void;
  onToggleTheme?: () => void;
  theme?: 'dark' | 'light';
}) {
  return (
    <div className="titlebar">
      <span className="titlebar-title">
        tiny-codex{projectName ? ` — ${projectName}` : ''}
      </span>
      <div className="titlebar-actions">
        {onToggleTheme && (
          <button onClick={onToggleTheme} className="titlebar-theme-btn">
            {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
        )}
        <button onClick={onOpen} className="titlebar-btn">Open</button>
        <button onClick={onCommit} className="titlebar-btn titlebar-btn-primary">Commit</button>
        {(diffStats.added > 0 || diffStats.removed > 0) && (
          <span className="titlebar-diff">
            <span className="diff-add">+{diffStats.added}</span>
            {' '}
            <span className="diff-del">-{diffStats.removed}</span>
          </span>
        )}
      </div>
    </div>
  );
}
