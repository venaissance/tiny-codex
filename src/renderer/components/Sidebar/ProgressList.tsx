import React from 'react';

export interface ProgressStep {
  label: string;
  status: 'done' | 'running' | 'pending';
}

const STATUS_ICON: Record<ProgressStep['status'], string> = {
  done: '\u2705',     // ✅
  running: '\u231B',  // ⏳
  pending: '\u25CB',  // ○
};

const STATUS_COLOR: Record<ProgressStep['status'], string> = {
  done: 'var(--success)',
  running: 'var(--accent)',
  pending: 'var(--text-muted)',
};

export function ProgressList({ steps }: { steps: ProgressStep[] }) {
  if (steps.length === 0) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No active task</div>;
  }

  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={i}
          className="sidebar-progress-step"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px',
            fontSize: 12,
            color: STATUS_COLOR[step.status],
            textDecoration: step.status === 'done' ? 'line-through' : 'none',
            opacity: step.status === 'done' ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
            {STATUS_ICON[step.status]}
          </span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
