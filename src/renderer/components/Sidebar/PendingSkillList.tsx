import React, { useEffect, useState, useCallback } from 'react';

export interface PendingSkill {
  name: string;
  description: string;
  triggers: string[];
  bodyExcerpt: string;
  path: string;
  pendingDir: string;
  createdAt: number;
}

const api = (window as any).api;

/**
 * Pending-skill list — renders skills proposed by the BackgroundReview agent
 * (Phase 3, Q3). Each item exposes Confirm / Reject buttons that call the
 * matching IPC channel; the list refreshes on review-complete events and
 * after manual user actions.
 */
export function PendingSkillList({ refreshKey }: { refreshKey?: number }) {
  const [items, setItems] = useState<PendingSkill[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!api?.listPendingSkills) return;
    api.listPendingSkills().then((list: PendingSkill[]) => setItems(list ?? [])).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleConfirm = useCallback(
    async (name: string) => {
      if (!api?.confirmPendingSkill) return;
      setBusy(name);
      try {
        await api.confirmPendingSkill(name);
      } finally {
        setBusy(null);
        load();
      }
    },
    [load],
  );

  const handleReject = useCallback(
    async (name: string) => {
      if (!api?.rejectPendingSkill) return;
      setBusy(name);
      try {
        await api.rejectPendingSkill(name);
      } finally {
        setBusy(null);
        load();
      }
    },
    [load],
  );

  if (items.length === 0) {
    return <div className="sidebar-empty">No pending skills</div>;
  }

  return (
    <div>
      {items.map((s) => (
        <div key={s.name} className="sidebar-item skill-item pending-skill-item" title={s.description}>
          <div className="skill-name">{s.name}</div>
          <div className="skill-desc">{s.description}</div>
          <div className="skill-actions" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              type="button"
              disabled={busy === s.name}
              onClick={() => handleConfirm(s.name)}
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              {busy === s.name ? '...' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={busy === s.name}
              onClick={() => handleReject(s.name)}
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
