import React, { useState, useEffect } from 'react';

export function Collapsible({ title, defaultOpen = false, forceOpen = false, children }: {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-expand when forceOpen becomes true
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className="sidebar-section">
      <div
        className="sidebar-section-title"
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        {title}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
