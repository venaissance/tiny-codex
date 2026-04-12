import React from 'react';

export function ModePicker({ mode, onChange }: {
  mode: 'local' | 'worktree';
  onChange: (mode: 'local' | 'worktree') => void;
}) {
  return (
    <div className="mode-picker">
      {(['local', 'worktree'] as const).map((m) => (
        <span
          key={m}
          onClick={() => onChange(m)}
          className={`mode-btn${m === mode ? ' active' : ''}`}
        >
          {m === 'local' ? 'Local' : 'Worktree'}
        </span>
      ))}
    </div>
  );
}
