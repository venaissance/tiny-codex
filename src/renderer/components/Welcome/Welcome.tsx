import React from 'react';
import { QuickCards } from './QuickCards';

export function Welcome({ onQuickAction, onOpenProject, projectPath }: {
  onQuickAction: (text: string) => void;
  onOpenProject?: () => void;
  projectPath?: string | null;
}) {
  return (
    <div className="welcome">
      <div className="welcome-icon">&#x1F680;</div>
      <h1 className="welcome-title">Let's build</h1>
      {projectPath ? (
        <p className="welcome-sub">{projectPath.split('/').pop()}</p>
      ) : (
        <p className="welcome-sub">
          <span
            onClick={onOpenProject}
            style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Open a project
          </span>
          {' '}or start a new thread
        </p>
      )}
      <QuickCards onSelect={onQuickAction} />
    </div>
  );
}
