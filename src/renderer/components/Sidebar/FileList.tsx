import React, { useEffect, useState, useRef } from 'react';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

function FileItem({ name, isDirectory, isSelected, onClick }: {
  name: string;
  isDirectory: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      className="sidebar-item"
      data-active={isSelected ? 'true' : 'false'}
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '4px 10px',
        cursor: isDirectory ? 'default' : 'pointer',
        opacity: isDirectory ? 0.7 : 1,
      }}
    >
      <span className="sidebar-item-icon" style={{ fontSize: 12 }}>
        {isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  );
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
          <FileItem
            key={f.name}
            name={f.name}
            isDirectory={f.isDirectory}
            isSelected={isSelected}
            onClick={() => !f.isDirectory && onSelectFile?.(fullPath)}
          />
        );
      })}
    </div>
  );
}
