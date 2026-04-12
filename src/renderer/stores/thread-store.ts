import { create } from 'zustand';

export type AgentStepState = 'idle' | 'thinking' | 'tool_calling' | 'reflecting' | 'completed' | 'error';

export interface Thread {
  id: string;
  title: string;
  projectPath: string;
  modelId: string;
  mode: 'local' | 'worktree';
  createdAt: number;
  updatedAt: number;
}

export interface ThreadMessage {
  role: string;
  content: Array<{ type: string; [key: string]: any }>;
}

interface ThreadState {
  threads: Thread[];
  activeThreadId: string | null;
  messages: ThreadMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  agentState: AgentStepState;
  agentStep: number;
  agentToolName: string | null;
  planItems: Array<{ id: number; task: string; status: 'pending' | 'running' | 'done' }>;
  addThread: (thread: Thread) => void;
  removeThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  setThreads: (threads: Thread[]) => void;
  setMessages: (messages: ThreadMessage[]) => void;
  appendMessage: (message: ThreadMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingText: (delta: string) => void;
  resetStreamingText: () => void;
  appendStreamingThinking: (delta: string) => void;
  resetStreamingThinking: () => void;
  setPlanItems: (items: Array<{ id: number; task: string; status: 'pending' | 'running' | 'done' }>) => void;
  setAgentState: (state: AgentStepState, step?: number, toolName?: string | null) => void;
}

export const useThreadStore = create<ThreadState>((set) => ({
  threads: [],
  activeThreadId: null,
  messages: [],
  isStreaming: false,
  streamingText: '',
  streamingThinking: '',
  agentState: 'idle',
  agentStep: 0,
  agentToolName: null,
  planItems: [],
  addThread: (thread) => set((s) => ({ threads: [...s.threads, thread] })),
  removeThread: (id) => set((s) => ({
    threads: s.threads.filter((t) => t.id !== id),
    activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
  })),
  setActiveThread: (id) => set({ activeThreadId: id }),
  setThreads: (threads) => set({ threads }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamingText: (delta) => set((s) => ({ streamingText: s.streamingText + delta })),
  resetStreamingText: () => set({ streamingText: '' }),
  appendStreamingThinking: (delta) => set((s) => ({ streamingThinking: s.streamingThinking + delta })),
  resetStreamingThinking: () => set({ streamingThinking: '' }),
  setPlanItems: (planItems) => set({ planItems }),
  setAgentState: (agentState, step, toolName) => set({
    agentState,
    ...(step !== undefined ? { agentStep: step } : {}),
    ...(toolName !== undefined ? { agentToolName: toolName } : {}),
  }),
}));
