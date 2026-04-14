import React, { useEffect, useState } from 'react';

const api = (window as any).api;

// Injected at the start of every previewed HTML to prevent navigation issues
const NAV_GUARD = `<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a');
  if (a) {
    var href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('#') || href === 'javascript:void(0)') {
      e.preventDefault();
    } else if (!href.startsWith('http')) {
      e.preventDefault();
    }
  }
});
</script>`;

export function HtmlView({ file }: { file: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (api?.readFile) {
      api.readFile(file).then((content: string) => {
        if (content && content.trim().length > 0) {
          setHtml(content);
        }
      });
    }
  }, [file]);

  if (!html) {
    return <div data-testid="html-view" style={{ padding: 16, color: 'var(--text-muted)' }}>No file selected</div>;
  }

  // Inject nav guard before </head> or at the start
  const safeHtml = html.includes('</head>')
    ? html.replace('</head>', NAV_GUARD + '</head>')
    : NAV_GUARD + html;

  return (
    <div data-testid="html-view" style={{ height: '100%' }}>
      <iframe
        srcDoc={safeHtml}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#fff' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
