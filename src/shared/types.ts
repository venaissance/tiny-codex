export interface ThreadInfo {
  id: string;
  title: string;
  projectPath: string;
  modelId: string;
  mode: 'local' | 'worktree';
  createdAt: number;
  updatedAt: number;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export interface StreamChunk {
  threadId: string;
  message: {
    role: string;
    content: Array<{ type: string; [key: string]: any }>;
  };
}
