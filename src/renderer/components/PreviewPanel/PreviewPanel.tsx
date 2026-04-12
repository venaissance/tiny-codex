import React, { useMemo, useRef, useCallback } from 'react';
import { MonacoView } from './MonacoView';
import { DiffView } from './DiffView';
import { MarkdownView } from './MarkdownView';
import { ImageView } from './ImageView';
import { PdfView } from './PdfView';
import { CsvJsonView } from './CsvJsonView';
import { HtmlView } from './HtmlView';

type Tab = 'preview' | 'code' | 'diff' | 'markdown' | 'image' | 'pdf' | 'csv' | 'json' | 'html';

function detectTab(file: string | null): Tab {
  if (!file) return 'preview';
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md') return 'markdown';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'code';
}

export function PreviewPanel({ file, content, originalContent, animated = false }: {
  file: string | null;
  content: string;
  originalContent?: string;
  animated?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const autoTab = useMemo(() => detectTab(file), [file]);
  const [activeTab, setActiveTab] = React.useState<Tab>(autoTab);

  // Drag to resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const startX = e.clientX;
    const startWidth = panel.offsetWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX; // dragging left = wider
      const newWidth = Math.max(300, Math.min(800, startWidth + delta));
      panel.style.width = newWidth + 'px';
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  React.useEffect(() => { setActiveTab(autoTab); }, [autoTab]);

  const tabs: Tab[] = useMemo(() => {
    const base: Tab[] = ['preview', 'code'];
    if (originalContent) base.push('diff');
    if (autoTab === 'image') base.push('image');
    if (autoTab === 'pdf') base.push('pdf');
    return [...new Set(base)];
  }, [originalContent, autoTab]);

  return (
    <div className="panel preview-panel" ref={panelRef}>
      {/* Drag handle for resizing */}
      <div
        className="preview-resize-handle"
        onMouseDown={handleMouseDown}
      />
      <div className="preview-tabs">
        {tabs.map((tab) => (
          <span
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`preview-tab${tab === activeTab ? ' active' : ''}`}
          >
            {tab === 'csv' ? 'CSV' : tab === 'json' ? 'JSON' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </span>
        ))}
      </div>
      <div className="preview-body">
        {activeTab === 'code' && file && <MonacoView file={file} content={content} />}
        {activeTab === 'diff' && file && originalContent && (
          <DiffView file={file} original={originalContent} modified={content} />
        )}
        {activeTab === 'markdown' && <MarkdownView content={content} basePath={file ? file.replace(/\/[^/]+$/, '') : ''} animated={animated} />}
        {activeTab === 'image' && file && <ImageView src={file} />}
        {activeTab === 'pdf' && file && <PdfView file={file} />}
        {activeTab === 'csv' && <CsvJsonView type="csv" content={content} />}
        {activeTab === 'json' && <CsvJsonView type="json" content={content} />}
        {activeTab === 'html' && file && <HtmlView file={file} />}
        {activeTab === 'preview' && (
          file ? (
            // Smart preview: render based on file type
            (() => {
              const ext = file.split('.').pop()?.toLowerCase() ?? '';
              if (ext === 'html' || ext === 'htm') return <HtmlView file={file} />;
              if (ext === 'md') return <MarkdownView content={content} basePath={file.replace(/\/[^/]+$/, '')} animated={animated} />;
              if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) return <ImageView src={file} />;
              if (ext === 'pdf') return <PdfView file={file} />;
              if (ext === 'csv') return <CsvJsonView type="csv" content={content} />;
              if (ext === 'json') return <CsvJsonView type="json" content={content} />;
              // Default: show as code
              return <MonacoView file={file} content={content} readOnly />;
            })()
          ) : (
            <div className="preview-empty">No file selected</div>
          )
        )}
      </div>
    </div>
  );
}
