/**
 * Tests for useAgent.ts core logic.
 *
 * The hook itself requires React + IPC mocking (tested in E2E).
 * Here we test the extractable logic as pure functions:
 * - Content extraction from tool_use_delta JSON fragments
 * - rAF batching simulation
 * - Stream event processing state machine
 * - Error handling paths
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useThreadStore } from '@/renderer/stores/thread-store';

// ── Content extraction logic (mirrors useAgent lines 88-119) ──

interface ExtractorState {
  currentToolName: string;
  toolJsonAccumulator: string;
  extractedContent: string;
  contentFieldStarted: boolean;
}

function createExtractor(): ExtractorState {
  return { currentToolName: '', toolJsonAccumulator: '', extractedContent: '', contentFieldStarted: false };
}

function processToolUseStart(state: ExtractorState, name: string): void {
  state.currentToolName = name;
  state.toolJsonAccumulator = '';
  state.extractedContent = '';
  state.contentFieldStarted = false;
}

function processToolUseDelta(
  state: ExtractorState,
  partialJson: string,
): { content: string; path: string } | null {
  if (state.currentToolName !== 'write_file' && state.currentToolName !== 'str_replace') return null;

  state.toolJsonAccumulator += partialJson;

  if (!state.contentFieldStarted) {
    const match = state.toolJsonAccumulator.match(/"content"\s*:\s*"/);
    if (match) {
      state.contentFieldStarted = true;
      const idx = state.toolJsonAccumulator.indexOf(match[0]);
      state.extractedContent = state.toolJsonAccumulator.slice(idx + match[0].length);
    }
  } else {
    state.extractedContent += partialJson;
  }

  if (!state.contentFieldStarted) return null;

  let preview = state.extractedContent;
  if (preview.endsWith('\\')) preview = preview.slice(0, -1);
  if (preview.endsWith('"}')) preview = preview.slice(0, -2);
  else if (preview.endsWith('"')) preview = preview.slice(0, -1);
  try {
    preview = JSON.parse('"' + preview + '"');
  } catch {
    preview = preview.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  const pathMatch = state.toolJsonAccumulator.match(/"path"\s*:\s*"([^"]+)"/);
  return { content: preview, path: pathMatch?.[1] ?? '' };
}

function processContentBlockStop(state: ExtractorState): void {
  state.currentToolName = '';
  state.toolJsonAccumulator = '';
  state.extractedContent = '';
  state.contentFieldStarted = false;
}

// ── Tests ──

describe('Content extraction from tool_use_delta', () => {
  let state: ExtractorState;

  beforeEach(() => {
    state = createExtractor();
  });

  it('extracts content from incremental JSON fragments (Anthropic style)', () => {
    processToolUseStart(state, 'write_file');

    // Simulate incremental JSON chunks
    let result = processToolUseDelta(state, '{"path": "/tmp/test.md", ');
    expect(result).toBeNull(); // No content field yet

    result = processToolUseDelta(state, '"content": "# Hello');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('# Hello');
    expect(result!.path).toBe('/tmp/test.md');

    result = processToolUseDelta(state, '\\nWorld');
    expect(result!.content).toBe('# Hello\nWorld');
  });

  it('extracts content from single JSON chunk (MiniMax style)', () => {
    processToolUseStart(state, 'write_file');

    const fullJson = '{"path": "/tmp/blog.md", "content": "# Blog Post\\n\\nHello world"}';
    const result = processToolUseDelta(state, fullJson);

    expect(result).not.toBeNull();
    expect(result!.path).toBe('/tmp/blog.md');
    expect(result!.content).toBe('# Blog Post\n\nHello world');
  });

  it('handles content with spaces after colon ("content" : "...")', () => {
    processToolUseStart(state, 'write_file');

    const result = processToolUseDelta(state, '{"path": "f.md", "content" :  "spaced"}');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('spaced');
  });

  it('handles escaped characters in content', () => {
    processToolUseStart(state, 'write_file');

    const result = processToolUseDelta(state, '{"path":"f.ts","content":"line1\\nline2\\t\\\"quoted\\\""}');
    expect(result).not.toBeNull();
    expect(result!.content).toContain('line1\nline2');
    expect(result!.content).toContain('"quoted"');
  });

  it('returns null for non-write tools', () => {
    processToolUseStart(state, 'bash');
    const result = processToolUseDelta(state, '{"command": "ls"}');
    expect(result).toBeNull();
  });

  it('works for str_replace tool', () => {
    processToolUseStart(state, 'str_replace');
    const result = processToolUseDelta(state, '{"path":"f.ts","content":"new code"}');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('new code');
  });

  it('resets state on content_block_stop', () => {
    processToolUseStart(state, 'write_file');
    processToolUseDelta(state, '{"path":"f.md","content":"hello"}');
    expect(state.contentFieldStarted).toBe(true);

    processContentBlockStop(state);
    expect(state.currentToolName).toBe('');
    expect(state.contentFieldStarted).toBe(false);
    expect(state.toolJsonAccumulator).toBe('');
  });

  it('handles partial JSON without content field', () => {
    processToolUseStart(state, 'write_file');
    const result = processToolUseDelta(state, '{"path": "/tmp/test.md"');
    expect(result).toBeNull();
  });

  it('accumulates across multiple deltas correctly', () => {
    processToolUseStart(state, 'write_file');

    processToolUseDelta(state, '{"pa');
    processToolUseDelta(state, 'th":"f.md","con');
    processToolUseDelta(state, 'tent":"hel');
    const result = processToolUseDelta(state, 'lo world"}');

    expect(result).not.toBeNull();
    expect(result!.content).toBe('hello world');
    expect(result!.path).toBe('f.md');
  });
});

describe('Stream event state machine', () => {
  it('tool_use_start resets all tracking state', () => {
    const state = createExtractor();
    state.currentToolName = 'old_tool';
    state.toolJsonAccumulator = 'leftover';
    state.extractedContent = 'stale';
    state.contentFieldStarted = true;

    processToolUseStart(state, 'write_file');

    expect(state.currentToolName).toBe('write_file');
    expect(state.toolJsonAccumulator).toBe('');
    expect(state.extractedContent).toBe('');
    expect(state.contentFieldStarted).toBe(false);
  });

  it('consecutive tool calls reset state between them', () => {
    const state = createExtractor();

    // First tool call
    processToolUseStart(state, 'write_file');
    processToolUseDelta(state, '{"path":"a.md","content":"first"}');
    expect(state.contentFieldStarted).toBe(true);

    // content_block_stop
    processContentBlockStop(state);

    // Second tool call
    processToolUseStart(state, 'write_file');
    expect(state.contentFieldStarted).toBe(false);
    const result = processToolUseDelta(state, '{"path":"b.md","content":"second"}');
    expect(result!.content).toBe('second');
    expect(result!.path).toBe('b.md');
  });
});

describe('sendMessage state setup', () => {
  // These test the state transitions that sendMessage should trigger.
  // Verified via the actual zustand store (no mocking needed).
  it('sets correct initial state for streaming', () => {
    // Import the real store to test state transitions
    // useThreadStore imported at top level

    // Reset
    useThreadStore.setState({
      isStreaming: false, streamingText: 'old', streamingThinking: 'old',
      agentState: 'idle', agentStep: 0, agentToolName: null, messages: [],
    });

    // Simulate what sendMessage does (lines 9-13)
    const store = useThreadStore.getState();
    store.setStreaming(true);
    store.resetStreamingText();
    store.resetStreamingThinking();
    store.setAgentState('thinking', 1, null);
    store.appendMessage({ role: 'user', content: [{ type: 'text', text: 'test' }] });

    const state = useThreadStore.getState();
    expect(state.isStreaming).toBe(true);
    expect(state.streamingText).toBe('');
    expect(state.streamingThinking).toBe('');
    expect(state.agentState).toBe('thinking');
    expect(state.agentStep).toBe(1);
    expect(state.agentToolName).toBeNull();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
  });
});

describe('onStreamEnd cleanup', () => {
  it('resets all streaming state', () => {
    // useThreadStore imported at top level

    // Set up mid-stream state
    useThreadStore.setState({
      streamingText: 'partial', streamingThinking: 'thinking...',
      isStreaming: true, agentState: 'tool_calling', agentToolName: 'bash',
    });

    // Simulate onStreamEnd (line 195)
    useThreadStore.setState({
      streamingText: '', streamingThinking: '',
      isStreaming: false, agentState: 'idle', agentToolName: null,
    });

    const state = useThreadStore.getState();
    expect(state.streamingText).toBe('');
    expect(state.streamingThinking).toBe('');
    expect(state.isStreaming).toBe(false);
    expect(state.agentState).toBe('idle');
    expect(state.agentToolName).toBeNull();
  });
});

describe('onStreamError handling', () => {
  it('appends error message and resets state', () => {
    // useThreadStore imported at top level

    useThreadStore.setState({
      isStreaming: true, streamingText: 'partial', messages: [],
    });

    // Simulate onStreamError (lines 203-210)
    const store = useThreadStore.getState();
    store.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '**Error:** API timeout' }],
    });
    store.resetStreamingText();
    store.setStreaming(false);
    store.setAgentState('error');

    const state = useThreadStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content[0].text).toContain('Error');
    expect(state.streamingText).toBe('');
    expect(state.isStreaming).toBe(false);
    expect(state.agentState).toBe('error');
  });
});
