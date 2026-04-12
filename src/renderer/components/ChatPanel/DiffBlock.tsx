import React from 'react';

export function DiffBlock({ file, oldStr, newStr }: { file?: string; oldStr: string; newStr: string }) {
  return (
    <div className="msg-tool" style={{ overflow: 'hidden', padding: 0 }}>
      {file && (
        <div style={{ background: 'var(--surface-active)', padding: '6px 12px', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{file}</span>
          <span>str_replace</span>
        </div>
      )}
      <div style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>
        {oldStr && <div className="diff-del">- {oldStr}</div>}
        {newStr && <div className="diff-add">+ {newStr}</div>}
      </div>
    </div>
  );
}
