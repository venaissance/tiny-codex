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
  { name: 'Tech Writer', icon: '📝' },
  { name: 'Code Review', icon: '🔍' },
  { name: 'Image Gen', icon: '🎨' },
];

const api = (window as any).api;

export function App() {
  const { threads, activeThreadId, messages, isStreaming, streamingText, agentState, agentStep, agentToolName, planItems } = useThreadStore();
  const { previewVisible, previewFile, projectPath, currentModel, mode, theme, togglePreview, setPreviewFile, setCurrentModel, setMode, setProjectPath, toggleTheme } = useUIStore();
  const { sendMessage, abortAgent } = useAgent();
  const { createThread, selectThread, deleteThread, openProject, commitChanges } = useThread();
  const [previewContent, setPreviewContent] = useState('');
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const [previewAnimated, setPreviewAnimated] = useState(false);
  // Guard: when true, live streaming preview is active — skip disk reads that would overwrite it
  const isLivePreviewingRef = useRef(false);

  // Refresh file list when streaming ends OR when a tool writes a file
  useEffect(() => {
    if (!isStreaming) {
      isLivePreviewingRef.current = false; // Streaming ended — safe to read from disk
      setFileRefreshKey((k) => k + 1);
    }
  }, [isStreaming]);

  useEffect(() => {
    const handler = () => setFileRefreshKey((k) => k + 1);
    window.addEventListener('file-changed', handler);
    return () => window.removeEventListener('file-changed', handler);
  }, []);

  // Live preview while agent is generating file content (before write_file completes)
  // Throttled with rAF to prevent flickering on high-frequency deltas (GLM sends many small chunks)
  useEffect(() => {
    let pendingContent = '';
    let pendingPath = '';
    let rafId: number | null = null;

    const flush = () => {
      rafId = null;
      if (pendingContent) {
        isLivePreviewingRef.current = true; // Protect from disk-read overwrite
        if (pendingPath && useUIStore.getState().previewFile !== pendingPath) {
          setPreviewFile(pendingPath);
        }
        setPreviewContent(pendingContent);
        setPreviewAnimated(false);
        if (!useUIStore.getState().previewVisible) togglePreview();
      }
    };

    const handler = (e: Event) => {
      const { content, path } = (e as CustomEvent).detail as { content: string; path: string };
      if (content) {
        pendingContent = content;
        if (path) pendingPath = path;
        if (!rafId) rafId = requestAnimationFrame(flush);
      }
    };

    window.addEventListener('file-writing', handler);
    return () => {
      window.removeEventListener('file-writing', handler);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [togglePreview, setPreviewFile]);

  // Auto-preview file when agent finishes writing it (tool result confirmed — file exists on disk)
  useEffect(() => {
    const handler = (e: Event) => {
      const filePath = (e as CustomEvent).detail as string;
      if (filePath) {
        isLivePreviewingRef.current = false; // File is on disk now, safe to read
        setPreviewFile(filePath);
        setPreviewAnimated(false);
        setFileRefreshKey((k) => k + 1);
        if (!useUIStore.getState().previewVisible) togglePreview();
      }
    };
    window.addEventListener('file-written', handler);
    return () => window.removeEventListener('file-written', handler);
  }, [setPreviewFile, togglePreview]);

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
  // GUARD: skip disk reads during live streaming preview to avoid flicker
  useEffect(() => {
    if (!previewFile) { setPreviewContent(''); return; }
    if (isLivePreviewingRef.current) return; // Don't overwrite live streaming preview
    if (api?.readFile) {
      api.readFile(previewFile).then((content: string) => {
        if (isLivePreviewingRef.current) return; // Re-check after async
        if (content === 'Error: Cannot read file') {
          // File was likely renamed/deleted — clear selection
          setPreviewFile(null);
          setPreviewContent('');
        } else {
          setPreviewContent(content || '');
        }
      }).catch(() => {
        if (isLivePreviewingRef.current) return;
        setPreviewFile(null);
        setPreviewContent('');
      });
    }
  }, [previewFile, fileRefreshKey, setPreviewFile]);

  const handleSelectFile = useCallback((filePath: string) => {
    setPreviewFile(filePath);
    setPreviewAnimated(false); // manual selection = no animation
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

    // Prefer plan items from PlannerMiddleware when available
    if (planItems.length > 0) {
      for (const item of planItems) {
        steps.push({ label: item.task, status: item.status });
      }
      // Add live indicator if still streaming
      if (isStreaming && !steps.some(s => s.status === 'running')) {
        const firstPending = steps.find(s => s.status === 'pending');
        if (firstPending) firstPending.status = 'running';
      }
      if (!isStreaming && hasStreamedRef.current) {
        steps.push({ label: 'Done', status: 'done' });
      }
      return steps;
    }

    // Fallback: tool-based progress tracking
    for (const s of completedStepsRef.current) {
      steps.push({ label: `Step ${s.step} \u00B7 ${s.label}`, status: 'done' });
    }

    if (isStreaming) {
      if (agentState === 'thinking') {
        steps.push({ label: `Step ${agentStep} \u00B7 Thinking...`, status: 'running' });
      } else if (agentState === 'tool_calling' && agentToolName) {
        steps.push({ label: `Step ${agentStep} \u00B7 Calling ${agentToolName}`, status: 'running' });
      } else if (agentState === 'reflecting') {
        steps.push({ label: `Step ${agentStep} \u00B7 Reflecting...`, status: 'running' });
      }
    } else if (hasStreamedRef.current) {
      steps.push({ label: 'Done', status: 'done' });
    }

    return steps;
  }, [messages, isStreaming, agentState, agentStep, agentToolName, planItems]);

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
        {activeThread && messages.length > 0 ? (
          <ChatPanel title={activeThread.title} messages={messages} streamingText={streamingText} isStreaming={isStreaming} onSuggestionSelect={(text) => activeThreadId && sendMessage(activeThreadId, text)}>
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
          <PreviewPanel file={previewFile} content={previewContent} animated={previewAnimated} />
        )}
      </div>
    </div>
  );
}
