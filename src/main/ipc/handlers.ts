import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { ThreadManager } from '../thread-manager';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { readSkillFrontMatter } from '../../agent/skills/skill-reader';

const execAsync = promisify(exec);

export function registerIpcHandlers(threadManager: ThreadManager, getWindow: () => BrowserWindow | null, appRoot: string): void {
  // Thread handlers
  ipcMain.handle(IPC.THREAD_CREATE, async (_event, params) => {
    return threadManager.createThread(params);
  });

  ipcMain.handle(IPC.THREAD_LIST, async () => {
    return threadManager.listThreads();
  });

  ipcMain.handle(IPC.THREAD_DELETE, async (_event, id: string) => {
    threadManager.deleteThread(id);
  });

  ipcMain.handle(IPC.THREAD_GET_MESSAGES, async (_event, threadId: string) => {
    return threadManager.getMessages(threadId);
  });

  // Agent handlers — streaming delta forwarding
  threadManager.onStreamDelta = (threadId, event) => {
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC.AGENT_STREAM_DELTA, { threadId, event });
    }
  };

  // Agent state change forwarding
  threadManager.onStateChange = (event) => {
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC.AGENT_STATE_CHANGE, event);
    }
  };

  // Agent plan update forwarding
  threadManager.onPlanUpdate = (threadId, items) => {
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC.AGENT_PLAN_UPDATE, { threadId, items });
    }
  };

  ipcMain.handle(IPC.AGENT_SEND_MESSAGE, async (_event, threadId: string, text: string, skillName?: string) => {
    const win = getWindow();
    if (!win) return;

    try {
      for await (const msg of threadManager.sendMessage(threadId, text, skillName)) {
        win.webContents.send(IPC.AGENT_STREAM_CHUNK, { threadId, message: msg });
      }
      win.webContents.send(IPC.AGENT_STREAM_END, threadId);
    } catch (err: any) {
      win.webContents.send(IPC.AGENT_STREAM_ERROR, err.message);
    }
  });

  ipcMain.handle(IPC.AGENT_ABORT, async (_event, threadId: string) => {
    threadManager.abortAgent(threadId);
  });

  // File handlers
  ipcMain.handle(IPC.FILE_OPEN_PROJECT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Project',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.FILE_COMMIT, async (_event, message: string) => {
    try {
      const { stdout } = await execAsync(`git add -A && git commit -m "${message.replace(/"/g, '\\"')}"`);
      return { success: true, output: stdout };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:readFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';  // File doesn't exist or can't be read — return empty, never error string
    }
  });

  ipcMain.handle('file:listFiles', async (_event, dirPath: string) => {
    const fs = await import('fs/promises');
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.FILE_CREATE, async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, '', 'utf-8');
    return { success: true };
  });

  ipcMain.handle(IPC.FILE_CREATE_DIR, async (_event, dirPath: string) => {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  });

  ipcMain.handle(IPC.FILE_DELETE, async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    await fs.rm(filePath, { recursive: true, force: true });
    return { success: true };
  });

  ipcMain.handle(IPC.FILE_RENAME, async (_event, oldPath: string, newPath: string) => {
    const fs = await import('fs/promises');
    await fs.rename(oldPath, newPath);
    return { success: true };
  });

  // Ask user — forward question to renderer
  threadManager.onAskUser = (threadId, question) => {
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC.AGENT_ASK_USER, { threadId, ...question });
    }
  };

  // Ask user — receive response from renderer
  ipcMain.handle(IPC.AGENT_ASK_USER_RESPOND, async (_event, threadId: string, response: string) => {
    threadManager.respondToAskUser(threadId, response);
  });

  ipcMain.handle(IPC.SKILL_LIST, async (_event, projectPath: string) => {
    // Scan both app's built-in skills AND the opened project's skills
    const appSkillsDir = join(appRoot, 'skills');
    const skillsDirs = [appSkillsDir, join(projectPath, 'skills')];
    const skills: Array<{ name: string; description: string; path: string }> = [];
    const seen = new Set<string>();
    for (const dir of skillsDirs) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillPath = join(dir, entry.name, 'SKILL.md');
          const fm = await readSkillFrontMatter(skillPath);
          if (fm && !seen.has(fm.name)) {
            seen.add(fm.name);
            skills.push({ name: fm.name, description: fm.description, path: skillPath });
          }
        }
      } catch {
        // skills dir doesn't exist — fine
      }
    }
    return skills;
  });

  ipcMain.handle(IPC.GIT_DIFF_STATS, async () => {
    try {
      const { stdout } = await execAsync('git diff --stat HEAD');
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const addMatch = lastLine.match(/(\d+) insertion/);
      const delMatch = lastLine.match(/(\d+) deletion/);
      return {
        added: addMatch ? parseInt(addMatch[1]) : 0,
        removed: delMatch ? parseInt(delMatch[1]) : 0,
      };
    } catch {
      return { added: 0, removed: 0 };
    }
  });
}
