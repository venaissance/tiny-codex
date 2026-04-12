import React from 'react';

export function PdfView({ file }: { file: string }) {
  return (
    <div data-testid="pdf-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <webview
        src={`file://${file}`}
        style={{ flex: 1 }}
        // @ts-ignore - Electron webview
        plugins="true"
      />
    </div>
  );
}
