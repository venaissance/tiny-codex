import React from 'react';

// DiffEditor loaded lazily to avoid blocking initial render
const DiffEditor: any = null; // Will use fallback diff view

function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', html: 'html', css: 'css', json: 'json', md: 'markdown',
  };
  return map[ext] ?? 'plaintext';
}

export function DiffView({ file, original, modified }: {
  file: string;
  original: string;
  modified: string;
}) {
  const language = detectLanguage(file);

  if (!DiffEditor) {
    // Fallback: simple line-by-line diff
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const maxLen = Math.max(origLines.length, modLines.length);

    return (
      <div data-testid="diff-view" style={{
        background: 'var(--surface-bg)', border: '1px solid var(--border)', borderRadius: 8,
        overflow: 'auto', fontFamily: "'SF Mono', Menlo, monospace", fontSize: 12, height: '100%',
      }}>
        <div style={{
          background: 'var(--canvas-bg)', padding: '6px 12px', display: 'flex',
          borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)',
        }}>
          <span>{file.split('/').pop()}</span>
          <span style={{ marginLeft: 'auto' }}>
            <span style={{ color: 'var(--diff-add)' }}>+{modLines.length - origLines.length > 0 ? modLines.length - origLines.length : 0}</span>
            {' '}
            <span style={{ color: 'var(--diff-del)' }}>-{origLines.length - modLines.length > 0 ? origLines.length - modLines.length : 0}</span>
          </span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {Array.from({ length: maxLen }, (_, i) => {
            const orig = origLines[i];
            const mod = modLines[i];
            if (orig === mod) {
              return <div key={i} style={{ padding: '1px 12px 1px 40px', color: 'var(--text-primary)', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>{i + 1}</span>
                {orig}
              </div>;
            }
            return (
              <React.Fragment key={i}>
                {orig !== undefined && (
                  <div style={{ padding: '1px 12px 1px 40px', color: 'var(--diff-del)', background: 'var(--diff-del-bg)', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, color: 'var(--diff-del)' }}>-</span>
                    {orig}
                  </div>
                )}
                {mod !== undefined && (
                  <div style={{ padding: '1px 12px 1px 40px', color: 'var(--diff-add)', background: 'var(--diff-add-bg)', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, color: 'var(--diff-add)' }}>+</span>
                    {mod}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="diff-view" style={{ height: '100%' }}>
      <DiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          renderSideBySide: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
