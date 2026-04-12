import React, { useEffect, useState } from 'react';

const api = (window as any).api;

export function HtmlView({ file }: { file: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (api?.readFile) {
      api.readFile(file).then((content: string) => setHtml(content));
    }
  }, [file]);

  if (!html) {
    return <div data-testid="html-view" style={{ padding: 16, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div data-testid="html-view" style={{ height: '100%' }}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#fff' }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
