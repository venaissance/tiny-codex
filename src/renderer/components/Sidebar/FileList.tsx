import React, { useEffect, useState } from 'react';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export function FileList({ projectPath, selectedFile, onSelectFile, refreshKey }: {
  projectPath: string | null;
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  refreshKey?: number;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectPath) { setFiles([]); return; }
    setLoading(true);
    const api = (window as any).api;
    if (api?.listFiles) {
      api.listFiles(projectPath).then((result: FileEntry[]) => {
        setFiles(result || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setFiles([]);
      setLoading(false);
    }
  }, [projectPath, refreshKey]);

  if (!projectPath) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No project opened</div>;
  }

  if (loading) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div>
      {files.length === 0 && (
        <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Empty</div>
      )}
      {files.map((f) => {
        const fullPath = `${projectPath}/${f.name}`;
        const isSelected = selectedFile === fullPath;
        return (
          <div
            key={f.name}
            className="sidebar-item"
            data-active={isSelected ? 'true' : 'false'}
            onClick={() => !f.isDirectory && onSelectFile?.(fullPath)}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              cursor: f.isDirectory ? 'default' : 'pointer',
              opacity: f.isDirectory ? 0.7 : 1,
            }}
          >
            <span className="sidebar-item-icon" style={{ fontSize: 12 }}>
              {f.isDirectory ? '📁' : '📄'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          </div>
        );
      })}
    </div>
  );
}
