import React, { useEffect, useState, useRef } from 'react';

interface Toast {
  id: number;
  text: string;
}

const api = (window as any).api;

/**
 * Minimal toast strip for BackgroundReview events.
 *
 * Uses the preload `onReviewComplete` channel; auto-dismiss after 4s. We
 * deliberately avoid pulling react-hot-toast or sonner — one stack-of-divs
 * is enough for v1 and keeps the bundle lean.
 */
export function ReviewToast({ onReviewComplete }: { onReviewComplete?: () => void }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const callbackRef = useRef(onReviewComplete);
  callbackRef.current = onReviewComplete;

  useEffect(() => {
    if (!api?.onReviewComplete) return;
    const unsub = api.onReviewComplete((data: any) => {
      if (!data || !data.ok) return;
      const memories = data.memoriesAdded ?? 0;
      const skills = data.skillsProposed ?? 0;
      if (memories === 0 && skills === 0) return;
      const parts: string[] = [];
      if (memories) parts.push(`${memories} memory entr${memories === 1 ? 'y' : 'ies'}`);
      if (skills) parts.push(`${skills} skill${skills === 1 ? '' : 's'} pending`);
      const text = `Learned ${parts.join(' \u00B7 ')}`;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, text }]);
      callbackRef.current?.();
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    });
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="review-toast-stack" style={toastStackStyle}>
      {toasts.map((t) => (
        <div key={t.id} style={toastStyle} role="status">
          {t.text}
        </div>
      ))}
    </div>
  );
}

const toastStackStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 9999,
  pointerEvents: 'none',
};

const toastStyle: React.CSSProperties = {
  background: 'var(--toast-bg, rgba(20, 20, 20, 0.92))',
  color: 'var(--toast-fg, #ffffff)',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  pointerEvents: 'auto',
  maxWidth: 320,
};
