import { useCallback, useEffect } from 'react';
import { useThreadStore } from '../stores/thread-store';
import { useUIStore } from '../stores/ui-store';

const api = (window as any).api;

export function useAgent() {
  const sendMessage = useCallback(async (threadId: string, text: string) => {
    useThreadStore.getState().setStreaming(true);
    useThreadStore.getState().resetStreamingText();
    useThreadStore.getState().setAgentState('thinking', 1, null);
    useThreadStore.getState().appendMessage({ role: 'user', content: [{ type: 'text', text }] });

    if (api?.sendMessage) {
      try {
        await api.sendMessage(threadId, text);
      } catch (err: any) {
        console.error('Agent error:', err);
        useThreadStore.getState().setStreaming(false);
      }
    } else {
      setTimeout(() => {
        useThreadStore.getState().appendMessage({
          role: 'assistant',
          content: [{ type: 'text', text: `[Dev mode] Echo: ${text}` }],
        });
        useThreadStore.getState().setStreaming(false);
      }, 500);
    }
  }, []);

  const abortAgent = useCallback((threadId: string) => {
    api?.abortAgent?.(threadId);
    useThreadStore.getState().setStreaming(false);
  }, []);

  useEffect(() => {
    if (!api) return;
    const cleanups: Array<() => void> = [];

    // Shared state for rAF batching — must be accessible by both delta and end handlers
    let pendingText = '';
    let rafId: number | null = null;

    // Stream delta — text appears token by token
    // Batch stream deltas with requestAnimationFrame for smooth rendering
    if (api.onStreamDelta) {
      const flushPending = () => {
        if (pendingText) {
          useThreadStore.getState().appendStreamingText(pendingText);
          pendingText = '';
        }
        rafId = null;
      };

      const unsub = api.onStreamDelta((data: any) => {
        const event = data.event;
        if (event.type === 'text_delta') {
          pendingText += event.text;
          if (!rafId) {
            rafId = requestAnimationFrame(flushPending);
          }
        }
      });
      if (unsub) cleanups.push(unsub);
      // Cleanup rAF on unmount
      cleanups.push(() => { if (rafId) cancelAnimationFrame(rafId); });
    }

    // Stream chunk — complete message (assistant or tool)
    // Add all messages immediately; streamingText is just a live preview
    if (api.onStreamChunk) {
      const unsub = api.onStreamChunk((chunk: any) => {
        const msg = chunk.message;
        useThreadStore.setState((s) => ({
          streamingText: '',
          messages: [...s.messages, msg],
        }));
        if (msg?.role === 'tool') {
          window.dispatchEvent(new CustomEvent('file-changed'));
        }
      });
      if (unsub) cleanups.push(unsub);
    }

    if (api.onStreamEnd) {
      const unsub = api.onStreamEnd(() => {
        // Cancel any pending rAF flush
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        pendingText = '';
        useThreadStore.setState({ streamingText: '', isStreaming: false, agentState: 'idle' as const, agentToolName: null });
      });
      if (unsub) cleanups.push(unsub);
    }

    if (api.onStreamError) {
      const unsub = api.onStreamError((err: string) => {
        console.error('Stream error:', err);
        // Show error to user as assistant message
        useThreadStore.getState().appendMessage({
          role: 'assistant',
          content: [{ type: 'text', text: `**Error:** ${err}` }],
        });
        useThreadStore.getState().resetStreamingText();
        useThreadStore.getState().setStreaming(false);
        useThreadStore.getState().setAgentState('error');
      });
      if (unsub) cleanups.push(unsub);
    }

    // Agent state change (thinking/tool_calling/reflecting/completed)
    if (api.onStateChange) {
      const unsub = api.onStateChange((event: any) => {
        useThreadStore.getState().setAgentState(
          event.state,
          event.step,
          event.toolName ?? null,
        );
      });
      if (unsub) cleanups.push(unsub);
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, []);

  return { sendMessage, abortAgent };
}
