import React from 'react';

interface Thread { id: string; title: string; updatedAt: number; }

export function ThreadList({ threads, activeId, onSelect }: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      {threads.map((t) => (
        <div
          key={t.id}
          data-active={t.id === activeId ? 'true' : 'false'}
          onClick={() => onSelect(t.id)}
          className="sidebar-item"
        >
          <span className="sidebar-item-icon">&#x270E;</span>
          {t.title}
        </div>
      ))}
    </div>
  );
}
