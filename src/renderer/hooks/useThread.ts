import { useCallback } from 'react';
import { useThreadStore } from '../stores/thread-store';
import { useUIStore } from '../stores/ui-store';
import { randomUUID } from '../utils';

const api = (window as any).api;

export function useThread() {
  const createThread = useCallback((title?: string) => {
    const store = useThreadStore.getState();

    // Abort any running agent before creating a new thread
    if (store.isStreaming && store.streamingThreadId) {
      api?.abortAgent?.(store.streamingThreadId);
    }

    const id = randomUUID();
    const projectPath = useUIStore.getState().projectPath || '';
    const thread = {
      id,
      title: title || 'New thread',
      projectPath,
      modelId: useUIStore.getState().currentModel,
      mode: useUIStore.getState().mode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add to local store immediately
    store.addThread(thread);
    store.setActiveThread(id);
    store.setMessages([]);
    store.resetStreamingText();
    store.setStreaming(false);
    store.setStreamingThreadId(null);
    store.setPendingQuestion(null);
    store.setAgentState('idle');

    // Sync to main process DB (must succeed before agent can use the thread)
    if (api?.createThread) {
      api.createThread({
        id,
        title: thread.title,
        projectPath: thread.projectPath,
        modelId: thread.modelId,
        mode: thread.mode,
      }).catch((err: any) => console.error('Failed to create thread in DB:', err));
    }

    return id;
  }, []);

  const selectThread = useCallback(async (id: string) => {
    const store = useThreadStore.getState();

    // Abort any running agent when switching threads
    if (store.isStreaming && store.streamingThreadId && store.streamingThreadId !== id) {
      api?.abortAgent?.(store.streamingThreadId);
    }

    store.setActiveThread(id);
    store.resetStreamingText();
    store.setStreaming(false);
    store.setStreamingThreadId(null);
    store.setPendingQuestion(null);
    store.setAgentState('idle');
    if (api?.getMessages) {
      try {
        const messages = await api.getMessages(id);
        useThreadStore.getState().setMessages(messages || []);
      } catch {
        useThreadStore.getState().setMessages([]);
      }
    } else {
      useThreadStore.getState().setMessages([]);
    }
  }, []);

  const deleteThread = useCallback((id: string) => {
    useThreadStore.getState().removeThread(id);
    api?.deleteThread?.(id);
  }, []);

  const openProject = useCallback(async () => {
    if (api?.openProject) {
      const path = await api.openProject();
      if (path) {
        useUIStore.getState().setProjectPath(path);
      }
    }
  }, []);

  const commitChanges = useCallback(async (message: string) => {
    if (api?.commit) {
      const result = await api.commit(message);
      return result;
    }
  }, []);

  return { createThread, selectThread, deleteThread, openProject, commitChanges };
}
