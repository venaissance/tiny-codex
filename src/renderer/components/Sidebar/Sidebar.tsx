import React from 'react';
import { ThreadList } from './ThreadList';
import { SkillList } from './SkillList';
import { Collapsible } from './Collapsible';
import { FileList } from './FileList';
import { ProgressList, type ProgressStep } from './ProgressList';
import { ContextList, type ContextItem } from './ContextList';

export function Sidebar({ threads, skills, activeThreadId, onSelectThread, onNewThread, onSkillClick, projectPath, progressSteps, contextItems, selectedFile, onSelectFile, fileRefreshKey }: {
  threads: Array<{ id: string; title: string; updatedAt: number }>;
  skills: Array<{ name: string; icon: string }>;
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSkillClick?: (skill: { name: string; icon: string }) => void;
  projectPath?: string | null;
  progressSteps?: ProgressStep[];
  contextItems?: ContextItem[];
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  fileRefreshKey?: number;
}) {
  return (
    <aside className="panel sidebar">
      <button onClick={onNewThread} className="sidebar-btn">+ New thread</button>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Threads</div>
        <ThreadList threads={threads} activeId={activeThreadId} onSelect={onSelectThread} />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Skills</div>
        <SkillList skills={skills} onSelect={onSkillClick} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

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
