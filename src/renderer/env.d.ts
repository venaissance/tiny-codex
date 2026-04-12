/// <reference types="vite/client" />

interface Window {
  api: {
    createThread: (params: any) => Promise<string>;
    listThreads: () => Promise<any[]>;
    deleteThread: (id: string) => Promise<void>;
    getMessages: (threadId: string) => Promise<any[]>;
    sendMessage: (threadId: string, text: string) => Promise<void>;
    abortAgent: (threadId: string) => Promise<void>;
    onStreamChunk: (cb: (msg: any) => void) => () => void;
    onStreamEnd: (cb: (threadId: string) => void) => () => void;
    onStreamError: (cb: (err: string) => void) => () => void;
    listFiles: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
    openProject: () => Promise<string | null>;
    commit: (message: string) => Promise<{ success: boolean; output?: string; error?: string }>;
    getDiffStats: () => Promise<{ added: number; removed: number }>;
  };
}
