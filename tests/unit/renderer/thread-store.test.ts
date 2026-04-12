import { describe, it, expect, beforeEach } from 'vitest';
import { useThreadStore } from '@/renderer/stores/thread-store';

describe('ThreadStore', () => {
  beforeEach(() => {
    useThreadStore.setState({
      threads: [],
      activeThreadId: null,
      messages: [],
      isStreaming: false,
    });
  });

  it('adds a thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    expect(useThreadStore.getState().threads).toHaveLength(1);
  });

  it('sets active thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    store.setActiveThread('t1');
    expect(useThreadStore.getState().activeThreadId).toBe('t1');
  });

  it('removes a thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    store.removeThread('t1');
    expect(useThreadStore.getState().threads).toHaveLength(0);
  });

  it('appends a message', () => {
    const store = useThreadStore.getState();
    store.appendMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    expect(useThreadStore.getState().messages).toHaveLength(1);
  });

  it('sets streaming state', () => {
    const store = useThreadStore.getState();
    store.setStreaming(true);
    expect(useThreadStore.getState().isStreaming).toBe(true);
  });

  it('sets agent state with step and tool name', () => {
    const store = useThreadStore.getState();
    store.setAgentState('tool_calling', 3, 'bash');
    const state = useThreadStore.getState();
    expect(state.agentState).toBe('tool_calling');
    expect(state.agentStep).toBe(3);
    expect(state.agentToolName).toBe('bash');
  });

  it('resets agent state to idle', () => {
    const store = useThreadStore.getState();
    store.setAgentState('thinking', 1, null);
    store.setAgentState('idle');
    expect(useThreadStore.getState().agentState).toBe('idle');
  });
});
