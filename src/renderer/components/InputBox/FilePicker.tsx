import React, { useEffect, useState } from 'react';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export function FilePicker({ projectPath, visible, filter, onSelect }: {
  projectPath: string | null;
  visible: boolean;
  filter: string;
  onSelect: (fileName: string) => void;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (!visible || !projectPath) return;
    const api = (window as any).api;
    if (api?.listFiles) {
      api.listFiles(projectPath).then((result: FileEntry[]) => {
        setFiles((result || []).filter((f) => !f.isDirectory));
      });
    }
  }, [visible, projectPath]);

  if (!visible) return null;

  const filtered = filter
    ? files.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : files;

  const extIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'md') return '📝';
    if (ext === 'html' || ext === 'htm') return '🌐';
    if (ext === 'ts' || ext === 'tsx') return '📘';
    if (ext === 'js' || ext === 'jsx') return '📒';
    if (ext === 'json') return '📋';
    if (ext === 'css') return '🎨';
    if (ext === 'py') return '🐍';
    return '📄';
  };

  return (
    <div className="skill-picker" style={{ maxHeight: 200, overflowY: 'auto' }}>
      {filtered.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
          {files.length === 0 ? 'No project opened' : 'No matching files'}
        </div>
      )}
      {filtered.map((f) => (
        <div key={f.name} className="skill-picker-item" onClick={() => onSelect(f.name)}>
          <span style={{ fontSize: 14 }}>{extIcon(f.name)}</span>
          {f.name}
        </div>
      ))}
    </div>
  );
}
