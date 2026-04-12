import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FilePicker } from './FilePicker';
import { CommandPicker } from './CommandPicker';
import { ModelPicker } from './ModelPicker';
import { ModePicker } from './ModePicker';

interface Skill { name: string; icon: string; }
interface AttachedFile { name: string; }

export function InputBox({ onSend, onAbort, isStreaming, skills, models, currentModel, onModelChange, mode, onModeChange, projectPath }: {
  onSend: (text: string, skills: Skill[], files?: AttachedFile[]) => void;
  onAbort?: () => void;
  isStreaming: boolean;
  skills: Skill[];
  models: string[];
  currentModel: string;
  onModelChange: (model: string) => void;
  mode: 'local' | 'worktree';
  onModeChange: (mode: 'local' | 'worktree') => void;
  projectPath?: string | null;
}) {
  const [text, setText] = useState('');
  const [activeSkills, setActiveSkills] = useState<Skill[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [pickerMode, setPickerMode] = useState<'none' | 'file' | 'command'>('none');
  const [pickerFilter, setPickerFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [text, adjustHeight]);

  // Listen for skill tags from Sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const skill = (e as CustomEvent).detail as Skill;
      if (!activeSkills.find((s) => s.name === skill.name)) {
        setActiveSkills((prev) => [...prev, skill]);
      }
      textareaRef.current?.focus();
    };
    window.addEventListener('add-skill-tag', handler);
    return () => window.removeEventListener('add-skill-tag', handler);
  }, [activeSkills]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const atMatch = val.match(/@([^@]*)$/);
    if (atMatch !== null) {
      setPickerMode('file');
      setPickerFilter(atMatch[1]);
      return;
    }

    if (val.startsWith('/')) {
      setPickerMode('command');
      setPickerFilter(val.slice(1));
      return;
    }

    setPickerMode('none');
    setPickerFilter('');
  };

  const handleFileSelect = (fileName: string) => {
    if (!attachedFiles.find((f) => f.name === fileName)) {
      setAttachedFiles((prev) => [...prev, { name: fileName }]);
    }
    setText(text.replace(/@[^@]*$/, ''));
    setPickerMode('none');
    textareaRef.current?.focus();
  };

  const handleSkillSelect = (skill: Skill) => {
    if (!activeSkills.find((s) => s.name === skill.name)) {
      setActiveSkills((prev) => [...prev, skill]);
    }
    setText('');
    setPickerMode('none');
    textareaRef.current?.focus();
  };

  const handleCommandSelect = (command: string) => {
    setText('');
    setPickerMode('none');
    if (command === 'add-files') {
      setPickerMode('file');
      setPickerFilter('');
    }
    textareaRef.current?.focus();
  };

  const doSubmit = useCallback(() => {
    if (!text.trim() || isStreaming) return;
    let fullText = text.trim();
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map((f) => f.name).join(', ');
      fullText = `[Attached files: ${fileList}]\n\n${fullText}`;
    }
    onSend(fullText, activeSkills, attachedFiles);
    setText('');
    setActiveSkills([]);
    setAttachedFiles([]);
    setPickerMode('none');
  }, [text, attachedFiles, activeSkills, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setPickerMode('none');
      return;
    }

    // Enter = submit, Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  return (
    <div className="input-area">
      <form onSubmit={handleSubmit}>
        <div className="input-box">
          <FilePicker
            projectPath={projectPath ?? null}
            visible={pickerMode === 'file'}
            filter={pickerFilter}
            onSelect={handleFileSelect}
          />
          <CommandPicker
            skills={skills}
            visible={pickerMode === 'command'}
            filter={pickerFilter}
            onSelectCommand={handleCommandSelect}
            onSelectSkill={handleSkillSelect}
          />

          {/* Tags: skills + files */}
          {(activeSkills.length > 0 || attachedFiles.length > 0) && (
            <div className="input-tags">
              {activeSkills.map((s) => (
                <span key={s.name} className="skill-tag" onClick={() => setActiveSkills((p) => p.filter((x) => x.name !== s.name))} title="Click to remove">
                  {s.icon} {s.name} ×
                </span>
              ))}
              {attachedFiles.map((f) => (
                <span key={f.name} className="skill-tag" onClick={() => setAttachedFiles((p) => p.filter((x) => x.name !== f.name))} style={{ color: 'var(--accent)' }} title="Click to remove">
                  📄 {f.name} ×
                </span>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, @ files, / commands..."
            className="input-textarea"
            rows={1}
            disabled={isStreaming}
          />

          {/* Toolbar */}
          <div className="input-toolbar">
            <button type="button" className="input-plus-btn" onClick={() => setPickerMode(pickerMode === 'file' ? 'none' : 'file')}>+</button>
            <ModelPicker models={models} current={currentModel} onChange={onModelChange} />
            <ModePicker mode={mode} onChange={onModeChange} />

            {isStreaming ? (
              <button
                type="button"
                onClick={onAbort}
                className="stop-btn"
                title="Stop generating"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                className="send-btn"
              >↑</button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
