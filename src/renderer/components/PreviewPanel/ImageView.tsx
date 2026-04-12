import React from 'react';

export function ImageView({ src }: { src: string | string[] }) {
  const sources = Array.isArray(src) ? src : [src];

  return (
    <div data-testid="image-view" style={{
      padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
    }}>
      {sources.map((s, i) => (
        <img
          key={i}
          src={s.startsWith('/') ? `file://${s}` : s}
          alt={`Image ${i + 1}`}
          style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, objectFit: 'contain' }}
        />
      ))}
    </div>
  );
}
