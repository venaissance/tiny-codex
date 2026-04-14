import { useCallback, useEffect } from 'react';
import { useThreadStore } from '../stores/thread-store';
import { useUIStore } from '../stores/ui-store';

const api = (window as any).api;

export function useAgent() {
  const sendMessage = useCallback(async (threadId: string, text: string, skillName?: string) => {
    const store = useThreadStore.getState();

    // Abort any running agent before starting a new one
    if (store.isStreaming && store.activeThreadId && store.activeThreadId !== threadId) {
      api?.abortAgent?.(store.activeThreadId);
    }

    store.setStreaming(true);
    store.setStreamingThreadId(threadId);
    store.resetStreamingText();
    store.resetStreamingThinking();
    store.setPlanItems([]);
    store.setPendingQuestion(null);
    store.setAgentState('thinking', 1, null);
    store.appendMessage({ role: 'user', content: [{ type: 'text', text }] });

    if (api?.sendMessage) {
      try {
        await api.sendMessage(threadId, text, skillName);
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

    // Track current tool_use for live preview of file content
    let currentToolName = '';
    let toolJsonAccumulator = '';
    let extractedContent = '';
    let contentFieldStarted = false;

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
        // Ignore events from a different thread
        if (data.threadId !== useThreadStore.getState().streamingThreadId) return;

        const event = data.event;
        if (event.type === 'text_delta') {
          pendingText += event.text;
          if (!rafId) {
            rafId = requestAnimationFrame(flushPending);
          }
        }

        // Thinking delta — show reasoning in real-time in the indicator card
        if (event.type === 'thinking_delta') {
          useThreadStore.getState().appendStreamingThinking(event.thinking);
        }

        // Track which tool is being called — update store immediately for UI indicator
        if (event.type === 'tool_use_start') {
          currentToolName = event.name;
          toolJsonAccumulator = '';
          extractedContent = '';
          contentFieldStarted = false;
          // Clear streaming text so AgentStateIndicator can show the tool name
          if (pendingText) { pendingText = ''; }
          useThreadStore.getState().resetStreamingText();
          useThreadStore.getState().setAgentState('tool_calling', undefined, event.name);
        }

        // Live extract write_file content from JSON delta fragments
        if (event.type === 'tool_use_delta' && (currentToolName === 'write_file' || currentToolName === 'str_replace')) {
          toolJsonAccumulator += event.partialJson;

          // Strategy: detect when "content": " appears, then accumulate everything after
          if (!contentFieldStarted) {
            const match = toolJsonAccumulator.match(/"content"\s*:\s*"/);
            if (match) {
              contentFieldStarted = true;
              const idx = toolJsonAccumulator.indexOf(match[0]);
              extractedContent = toolJsonAccumulator.slice(idx + match[0].length);
            }
          } else {
            extractedContent += event.partialJson;
          }

          if (contentFieldStarted) {
            // Unescape JSON string (handle \n, \", \\)
            let preview = extractedContent;
            // Remove trailing JSON structure: incomplete escape, closing "}, or closing "
            if (preview.endsWith('\\')) preview = preview.slice(0, -1);
            if (preview.endsWith('"}')) preview = preview.slice(0, -2);
            else if (preview.endsWith('"')) preview = preview.slice(0, -1);
            try {
              preview = JSON.parse('"' + preview + '"');
            } catch {
              preview = preview.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            // Extract file path from accumulated JSON for preview tab detection
            const pathMatch = toolJsonAccumulator.match(/"path"\s*:\s*"([^"]+)"/);
            window.dispatchEvent(new CustomEvent('file-writing', {
              detail: { content: preview, path: pathMatch?.[1] ?? '' },
            }));
          }
        }

        // Reset tool tracking on block stop
        if (event.type === 'content_block_stop') {
          currentToolName = '';
          toolJsonAccumulator = '';
          extractedContent = '';
          contentFieldStarted = false;
        }
      });
      if (unsub) cleanups.push(unsub);
      // Cleanup rAF on unmount
      cleanups.push(() => { if (rafId) cancelAnimationFrame(rafId); });
    }

    // Stream chunk — complete message (assistant or tool)
    // Add all messages immediately; streamingText is just a live preview
    //
    // CRITICAL: file-written must only fire AFTER tool execution (when file exists on disk).
    // Dispatching from assistant message (tool_use intent) causes flicker because the file
    // hasn't been written yet — readFile fails → preview clears → tool writes → preview reopens.
    // Fix: track pending paths by toolUseId, dispatch when matching tool result arrives.
    const pendingWrites = new Map<string, string>(); // toolUseId → filePath

    if (api.onStreamChunk) {
      const unsub = api.onStreamChunk((chunk: any) => {
        // Ignore chunks from a different thread
        if (chunk.threadId && chunk.threadId !== useThreadStore.getState().streamingThreadId) return;

        const msg = chunk.message;
        useThreadStore.setState((s) => ({
          streamingText: '',
          messages: [...s.messages, msg],
        }));
        if (msg?.role === 'assistant') {
          // Track pending file writes — DON'T dispatch file-written yet (file not on disk)
          for (const c of msg.content ?? []) {
            if (c.type === 'tool_use' && (c.name === 'write_file' || c.name === 'str_replace')) {
              const filePath = c.input?.path;
              if (filePath) pendingWrites.set(c.id, filePath);
            }
            if (c.type === 'tool_use' && c.name === 'bash') {
              const cmd = (c.input?.command ?? '').trim();
              const mvMatch = cmd.match(/\bmv\s+(?:-\S+\s+)*(?:"[^"]+"|'[^']+'|\S+)\s+("[^"]+"|'[^']+'|(\S+))\s*$/);
              if (mvMatch) {
                const dest = (mvMatch[1] || mvMatch[2]).replace(/^["']|["']$/g, '');
                pendingWrites.set(c.id, dest);
              }
            }
          }
        }
        if (msg?.role === 'tool') {
          window.dispatchEvent(new CustomEvent('file-changed'));
          for (const c of msg.content ?? []) {
            // Match tool result to pending write by toolUseId — file now exists on disk
            const toolUseId = c.toolUseId ?? c.tool_use_id;
            if (toolUseId && pendingWrites.has(toolUseId)) {
              const filePath = pendingWrites.get(toolUseId)!;
              window.dispatchEvent(new CustomEvent('file-written', { detail: filePath }));
              pendingWrites.delete(toolUseId);
            }
            // Fallback: parse tool result text for "File written: /path"
            const text = typeof c.content === 'string' ? c.content : '';
            const writtenMatch = text.match(/File written:\s*(\S+)/);
            if (writtenMatch) {
              window.dispatchEvent(new CustomEvent('file-written', { detail: writtenMatch[1] }));
            }
          }
        }
      });
      if (unsub) cleanups.push(unsub);
    }

    if (api.onStreamEnd) {
      const unsub = api.onStreamEnd((threadId: string) => {
        // Ignore end events from a different thread (aborted thread finishing)
        if (threadId && threadId !== useThreadStore.getState().streamingThreadId) return;
        // Cancel any pending rAF flush
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        pendingText = '';
        useThreadStore.setState({ streamingText: '', streamingThinking: '', isStreaming: false, streamingThreadId: null, agentState: 'idle' as const, agentToolName: null });
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
        if (event.threadId && event.threadId !== useThreadStore.getState().streamingThreadId) return;
        useThreadStore.getState().setAgentState(
          event.state,
          event.step,
          event.toolName ?? null,
        );
      });
      if (unsub) cleanups.push(unsub);
    }

    // Agent plan update (from PlannerMiddleware)
    if (api.onPlanUpdate) {
      const unsub = api.onPlanUpdate((data: any) => {
        if (data.threadId && data.threadId !== useThreadStore.getState().streamingThreadId) return;
        useThreadStore.getState().setPlanItems(data.items);
      });
      if (unsub) cleanups.push(unsub);
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, []);

  return { sendMessage, abortAgent };
}
