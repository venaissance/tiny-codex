import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('api', {
  createThread: (params: any) => ipcRenderer.invoke(IPC.THREAD_CREATE, params),
  listThreads: () => ipcRenderer.invoke(IPC.THREAD_LIST),
  deleteThread: (id: string) => ipcRenderer.invoke(IPC.THREAD_DELETE, id),
  getMessages: (threadId: string) => ipcRenderer.invoke(IPC.THREAD_GET_MESSAGES, threadId),

  sendMessage: (threadId: string, text: string, skillName?: string) => ipcRenderer.invoke(IPC.AGENT_SEND_MESSAGE, threadId, text, skillName),
  abortAgent: (threadId: string) => ipcRenderer.invoke(IPC.AGENT_ABORT, threadId),

  onStreamDelta: (cb: (data: any) => void) => {
    const handler = (_: any, data: any) => cb(data);
    ipcRenderer.on(IPC.AGENT_STREAM_DELTA, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_DELTA, handler);
  },
  onStreamChunk: (cb: (msg: any) => void) => {
    const handler = (_: any, msg: any) => cb(msg);
    ipcRenderer.on(IPC.AGENT_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_CHUNK, handler);
  },
  onStreamEnd: (cb: (threadId: string) => void) => {
    const handler = (_: any, threadId: string) => cb(threadId);
    ipcRenderer.on(IPC.AGENT_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_END, handler);
  },
  onStreamError: (cb: (err: string) => void) => {
    const handler = (_: any, err: string) => cb(err);
    ipcRenderer.on(IPC.AGENT_STREAM_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_ERROR, handler);
  },
  onStateChange: (cb: (event: any) => void) => {
    const handler = (_: any, event: any) => cb(event);
    ipcRenderer.on(IPC.AGENT_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STATE_CHANGE, handler);
  },
  onPlanUpdate: (cb: (data: any) => void) => {
    const handler = (_: any, data: any) => cb(data);
    ipcRenderer.on(IPC.AGENT_PLAN_UPDATE, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_PLAN_UPDATE, handler);
  },

  onSetProjectPath: (cb: (path: string) => void) => {
    const handler = (_: any, path: string) => cb(path);
    ipcRenderer.on('set-project-path', handler);
    return () => ipcRenderer.removeListener('set-project-path', handler);
  },
  readFile: (filePath: string) => ipcRenderer.invoke('file:readFile', filePath),
  listFiles: (dirPath: string) => ipcRenderer.invoke('file:listFiles', dirPath),
  createFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_CREATE, filePath),
  createDir: (dirPath: string) => ipcRenderer.invoke(IPC.FILE_CREATE_DIR, dirPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke(IPC.FILE_DELETE, filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke(IPC.FILE_RENAME, oldPath, newPath),
  onAskUser: (cb: (data: any) => void) => {
    const handler = (_: any, data: any) => cb(data);
    ipcRenderer.on(IPC.AGENT_ASK_USER, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_ASK_USER, handler);
  },
  respondToAskUser: (threadId: string, response: string) => ipcRenderer.invoke(IPC.AGENT_ASK_USER_RESPOND, threadId, response),
  listSkills: (projectPath: string) => ipcRenderer.invoke(IPC.SKILL_LIST, projectPath),
  openProject: () => ipcRenderer.invoke(IPC.FILE_OPEN_PROJECT),
  commit: (message: string) => ipcRenderer.invoke(IPC.FILE_COMMIT, message),
  getDiffStats: () => ipcRenderer.invoke(IPC.GIT_DIFF_STATS),
});
