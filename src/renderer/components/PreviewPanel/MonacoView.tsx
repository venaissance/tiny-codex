import React, { useMemo, useState, useRef, lazy, Suspense } from 'react';

const Editor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.default })));

function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml',
    sh: 'shell', bash: 'shell', sql: 'sql', graphql: 'graphql',
    rs: 'rust', go: 'go', java: 'java', rb: 'ruby', php: 'php',
    swift: 'swift', kt: 'kotlin', c: 'c', cpp: 'cpp', h: 'c',
  };
  return map[ext] ?? 'plaintext';
}

export function MonacoView({ file, content, readOnly = false, onSave }: {
  file: string;
  content: string;
  readOnly?: boolean;
  onSave?: (content: string) => void;
}) {
  const language = useMemo(() => detectLanguage(file), [file]);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<any>(null);

  const handleCopy = async () => {
    const text = editorRef.current?.getValue() || content;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    // Cmd+S to save
    editor.addCommand(2097, () => { // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS
      if (onSave) {
        onSave(editor.getValue());
      }
    });
  };

  const fileName = file.split('/').pop() || '';

  return (
    <div data-testid="monaco-view" data-language={language} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: 'var(--canvas-bg)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{fileName}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{language}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={handleCopy}
            style={{
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              color: copied ? 'var(--success)' : 'var(--text-secondary)',
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1 }}>
        <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading editor...</div>}>
        <Editor
          height="100%"
          language={language}
          value={content}
          theme={document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'vs-dark'}
          onMount={handleEditorMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8 },
            renderLineHighlight: 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
        </Suspense>
      </div>
    </div>
  );
}
