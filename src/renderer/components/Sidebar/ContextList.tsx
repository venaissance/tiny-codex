import React from 'react';

export interface ContextItem {
  type: 'tool' | 'skill' | 'connector';
  name: string;
  count?: number;
}

export function ContextList({ items }: { items: ContextItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No tools used yet</div>;
  }

  const iconMap = { tool: '🔧', skill: '⚡', connector: '🌐' };

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="sidebar-item" style={{ fontSize: 12, padding: '4px 10px' }}>
          <span className="sidebar-item-icon" style={{ fontSize: 12 }}>{iconMap[item.type]}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          {item.count && item.count > 1 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>x{item.count}</span>
          )}
        </div>
      ))}
    </div>
  );
}
