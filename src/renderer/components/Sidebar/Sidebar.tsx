import React, { useRef, useCallback } from 'react';
import { ThreadList } from './ThreadList';
import { SkillList, type SkillInfo } from './SkillList';
import { Collapsible } from './Collapsible';
import { FileList } from './FileList';
import { ProgressList, type ProgressStep } from './ProgressList';
import { ContextList, type ContextItem } from './ContextList';

export function Sidebar({ threads, skills, activeThreadId, onSelectThread, onNewThread, onSkillClick, projectPath, progressSteps, contextItems, selectedFile, onSelectFile, fileRefreshKey }: {
  threads: Array<{ id: string; title: string; updatedAt: number }>;
  skills: SkillInfo[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSkillClick?: (skill: SkillInfo) => void;
  projectPath?: string | null;
  progressSteps?: ProgressStep[];
  contextItems?: ContextItem[];
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  fileRefreshKey?: number;
}) {
  const sidebarRef = useRef<HTMLElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const startX = e.clientX;
    const startWidth = sidebar.offsetWidth;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(400, startWidth + (ev.clientX - startX)));
      sidebar.style.width = newWidth + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return (
    <aside className="panel sidebar" ref={sidebarRef}>
      <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} />
      <button onClick={onNewThread} className="sidebar-btn">+ New thread</button>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Threads</div>
        <ThreadList threads={threads} activeId={activeThreadId} onSelect={onSelectThread} />
      </div>

      <Collapsible title="SKILLS" defaultOpen={true}>
        <SkillList skills={skills} onSelect={onSkillClick} />
      </Collapsible>

      <Collapsible title="FILES" defaultOpen={true}>
        <FileList projectPath={projectPath ?? null} selectedFile={selectedFile} onSelectFile={onSelectFile} refreshKey={fileRefreshKey} />
      </Collapsible>

      <Collapsible title="PROGRESS" forceOpen={(progressSteps ?? []).length > 0}>
        <ProgressList steps={progressSteps ?? []} />
      </Collapsible>

      <Collapsible title="CONTEXT">
        <ContextList items={contextItems ?? []} />
      </Collapsible>
    </aside>
  );
}
