import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useThreadStore } from './stores/thread-store';
import { useUIStore } from './stores/ui-store';
import { darkTheme, lightTheme, applyTheme } from './theme';
import { Titlebar } from './components/Titlebar/Titlebar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { InputBox } from './components/InputBox/InputBox';
import { PreviewPanel } from './components/PreviewPanel/PreviewPanel';
import { Welcome } from './components/Welcome/Welcome';
import { useAgent } from './hooks/useAgent';
import { useThread } from './hooks/useThread';

const MODELS = ['MiniMax-M2.7', 'glm-5.1'];
const SKILLS = [
  { name: 'Image Gen', icon: '🎨' },
  { name: 'Tech Writer', icon: '📝' },
  { name: 'Code Review', icon: '🔍' },
];

const api = (window as any).api;

export function App() {
  const { threads, activeThreadId, messages, isStreaming, streamingText, agentState, agentStep, agentToolName } = useThreadStore();
  const { previewVisible, previewFile, projectPath, currentModel, mode, theme, togglePreview, setPreviewFile, setCurrentModel, setMode, setProjectPath, toggleTheme } = useUIStore();
  const { sendMessage, abortAgent } = useAgent();
  const { createThread, selectThread, deleteThread, openProject, commitChanges } = useThread();
  const [previewContent, setPreviewContent] = useState('');
  const [fileRefreshKey, setFileRefreshKey] = useState(0);

  // Refresh file list when streaming ends OR when a tool writes a file
  useEffect(() => {
    if (!isStreaming) {
      setFileRefreshKey((k) => k + 1);
    }
  }, [isStreaming]);

  useEffect(() => {
    const handler = () => setFileRefreshKey((k) => k + 1);
    window.addEventListener('file-changed', handler);
    return () => window.removeEventListener('file-changed', handler);
  }, []);

  // Apply theme
  useEffect(() => {
    applyTheme(theme === 'dark' ? darkTheme : lightTheme);
  }, [theme]);

  // Listen for default project path from main process
  useEffect(() => {
    if (api?.onSetProjectPath) {
      const unsub = api.onSetProjectPath((path: string) => {
        setProjectPath(path);
      });
      return unsub;
    }
  }, [setProjectPath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '\\') { e.preventDefault(); togglePreview(); }
      if (e.metaKey && e.key === 'n') { e.preventDefault(); createThread(); }
      if (e.metaKey && e.key === 'o') { e.preventDefault(); openProject(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePreview, createThread, openProject]);

  // Read file content when previewFile changes OR when streaming ends (file may have been modified)
  useEffect(() => {
    if (!previewFile) { setPreviewContent(''); return; }
    if (api?.readFile) {
      api.readFile(previewFile).then((content: string) => {
        setPreviewContent(content || '');
      }).catch(() => setPreviewContent('Error reading file'));
    }
  }, [previewFile, fileRefreshKey]);

  const handleSelectFile = useCallback((filePath: string) => {
    setPreviewFile(filePath);
    // Auto-show preview panel if hidden
    if (!useUIStore.getState().previewVisible) {
      togglePreview();
    }
  }, [setPreviewFile, togglePreview]);

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const projectName = projectPath?.split('/').pop() ?? null;

  // Track completed steps across the current streaming session
  const completedStepsRef = useRef<Array<{ step: number; label: string }>>([]);
  const hasStreamedRef = useRef(false);

  // Reset when a new message starts streaming
  useEffect(() => {
    if (isStreaming && agentStep === 1 && agentState === 'thinking') {
      completedStepsRef.current = [];
      hasStreamedRef.current = true;
    }
  }, [isStreaming, agentStep, agentState]);

  // Record completed tool calls from messages as they arrive
  useEffect(() => {
    if (!isStreaming) return;
    const seen = new Set(completedStepsRef.current.map(s => `${s.step}-${s.label}`));
    let stepCounter = 0;
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        stepCounter++;
        for (const c of msg.content) {
          if (c.type === 'tool_use') {
            const key = `${stepCounter}-${c.name}`;
            if (!seen.has(key)) {
              completedStepsRef.current.push({ step: stepCounter, label: c.name });
              seen.add(key);
            }
          }
        }
      }
    }
  }, [messages, isStreaming]);

  const progressSteps = useMemo(() => {
    const steps: Array<{ label: string; status: 'done' | 'running' | 'pending' }> = [];

    if (!isStreaming && !hasStreamedRef.current) {
      return steps;
    }

    // Add all completed tool steps
    for (const s of completedStepsRef.current) {
      steps.push({ label: `Step ${s.step} \u00B7 ${s.label}`, status: 'done' });
    }

    // Add current live step
    if (isStreaming) {
      if (agentState === 'thinking') {
        steps.push({ label: `Step ${agentStep} \u00B7 Thinking...`, status: 'running' });
      } else if (agentState === 'tool_calling' && agentToolName) {
        steps.push({ label: `Step ${agentStep} \u00B7 Calling ${agentToolName}`, status: 'running' });
      } else if (agentState === 'reflecting') {
        steps.push({ label: `Step ${agentStep} \u00B7 Reflecting...`, status: 'running' });
      }
    } else if (hasStreamedRef.current) {
      // Streaming ended — show Done
      steps.push({ label: 'Done', status: 'done' });
    }

    return steps;
  }, [messages, isStreaming, agentState, agentStep, agentToolName]);

  const contextItems = useMemo(() => {
    const toolCounts = new Map<string, number>();
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'tool_use') {
            toolCounts.set(c.name, (toolCounts.get(c.name) || 0) + 1);
          }
        }
      }
    }
    return Array.from(toolCounts.entries()).map(([name, count]) => ({
      type: 'tool' as const,
      name,
      count,
    }));
  }, [messages]);

  const handleSend = useCallback((text: string, skills: Array<{ name: string; icon: string }>) => {
    if (!activeThreadId) {
      const threadId = createThread(text.slice(0, 50));
      if (threadId) sendMessage(threadId, text);
    } else {
      sendMessage(activeThreadId, text);
    }
  }, [activeThreadId, createThread, sendMessage]);

  const handleQuickAction = useCallback((text: string) => {
    const threadId = createThread(text);
    if (threadId) sendMessage(threadId, text);
  }, [createThread, sendMessage]);

  return (
    <div className="app">
      <Titlebar
        projectName={projectName}
        diffStats={{ added: 0, removed: 0 }}
        onOpen={openProject}
        onCommit={() => commitChanges('Update from tiny-codex')}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <div className="app-body">
        <Sidebar
          threads={threads.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt }))}
          skills={SKILLS}
          activeThreadId={activeThreadId}
          onSelectThread={selectThread}
          onNewThread={() => createThread()}
          onSkillClick={(skill) => {
            if (!activeThreadId) createThread();
            window.dispatchEvent(new CustomEvent('add-skill-tag', { detail: skill }));
          }}
          projectPath={projectPath}
          progressSteps={progressSteps}
          contextItems={contextItems}
          selectedFile={previewFile}
          onSelectFile={handleSelectFile}
          fileRefreshKey={fileRefreshKey}
        />
        {activeThread ? (
          <ChatPanel title={activeThread.title} messages={messages} streamingText={streamingText}>
            <InputBox
              onSend={handleSend}
              onAbort={() => activeThreadId && abortAgent(activeThreadId)}
              isStreaming={isStreaming}
              skills={SKILLS}
              models={MODELS}
              currentModel={currentModel}
              onModelChange={setCurrentModel}
              mode={mode}
              onModeChange={setMode}
              projectPath={projectPath}
            />
          </ChatPanel>
        ) : (
          <div className="panel chat-panel">
            <Welcome onQuickAction={handleQuickAction} onOpenProject={openProject} projectPath={projectPath} />
            <InputBox
              onSend={handleSend}
              isStreaming={isStreaming}
              skills={SKILLS}
              models={MODELS}
              currentModel={currentModel}
              onModelChange={setCurrentModel}
              mode={mode}
              projectPath={projectPath}
              onModeChange={setMode}
            />
          </div>
        )}
        {previewVisible && (
          <PreviewPanel file={previewFile} content={previewContent} />
        )}
      </div>
    </div>
  );
}
