import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC } from '@/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() ensures variables exist before vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  handlers,
  mockIpcMain,
  mockDialog,
  mockWebContentsSend,
  mockExecAsync,
  mockReadFile,
  mockReaddir,
} = vi.hoisted(() => {
  const handlers = new Map<string, Function>();
  return {
    handlers,
    mockIpcMain: {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
    },
    mockDialog: { showOpenDialog: vi.fn() },
    mockWebContentsSend: vi.fn(),
    mockExecAsync: vi.fn(),
    mockReadFile: vi.fn(),
    mockReaddir: vi.fn(),
  };
});

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  BrowserWindow: {},
}));

// The source does `const execAsync = promisify(exec)` at module scope.
// We mock `child_process` so that exec carries the custom promisify symbol,
// making `promisify(exec)` return our controllable mockExecAsync.
vi.mock('child_process', () => {
  const { promisify } = require('util');
  const exec = (() => {}) as any;
  exec[promisify.custom] = mockExecAsync;
  return { exec };
});

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------
import { registerIpcHandlers } from '@/main/ipc/handlers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockThreadManager() {
  return {
    createThread: vi.fn().mockReturnValue('thread-1'),
    listThreads: vi.fn().mockReturnValue([{ id: 'thread-1', title: 'T1' }]),
    deleteThread: vi.fn(),
    getMessages: vi.fn().mockReturnValue([{ role: 'user', content: 'hi' }]),
    sendMessage: vi.fn(),
    abortAgent: vi.fn(),
    onStreamDelta: undefined as any,
    onStateChange: undefined as any,
  };
}

/** Configure mockExecAsync (the promisified exec) to resolve or reject. */
function setupExec(result: { stdout?: string; stderr?: string } | Error) {
  if (result instanceof Error) {
    mockExecAsync.mockRejectedValue(result);
  } else {
    mockExecAsync.mockResolvedValue({ stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
  }
}

const mockEvent = {} as Electron.IpcMainInvokeEvent;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerIpcHandlers', () => {
  let tm: ReturnType<typeof makeMockThreadManager>;
  let getWindow: () => any;

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();

    tm = makeMockThreadManager();
    getWindow = () => ({ webContents: { send: mockWebContentsSend } });

    registerIpcHandlers(tm as any, getWindow as any);
  });

  // ── Thread handlers ─────────────────────────────────────────────────

  it('THREAD_CREATE → calls threadManager.createThread, returns ID', async () => {
    const params = { title: 'New', projectPath: '/tmp', modelId: 'm1', mode: 'local' as const };
    const result = await handlers.get(IPC.THREAD_CREATE)!(mockEvent, params);
    expect(tm.createThread).toHaveBeenCalledWith(params);
    expect(result).toBe('thread-1');
  });

  it('THREAD_LIST → returns thread list', async () => {
    const result = await handlers.get(IPC.THREAD_LIST)!(mockEvent);
    expect(tm.listThreads).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'thread-1', title: 'T1' }]);
  });

  it('THREAD_DELETE → calls deleteThread', async () => {
    await handlers.get(IPC.THREAD_DELETE)!(mockEvent, 'thread-1');
    expect(tm.deleteThread).toHaveBeenCalledWith('thread-1');
  });

  it('THREAD_GET_MESSAGES → returns messages', async () => {
    const result = await handlers.get(IPC.THREAD_GET_MESSAGES)!(mockEvent, 'thread-1');
    expect(tm.getMessages).toHaveBeenCalledWith('thread-1');
    expect(result).toEqual([{ role: 'user', content: 'hi' }]);
  });

  // ── Agent handlers ──────────────────────────────────────────────────

  it('AGENT_SEND_MESSAGE → iterates generator, sends chunks via IPC, then sends end', async () => {
    const chunks = [
      { role: 'assistant', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    async function* fakeStream() {
      for (const c of chunks) yield c;
    }
    tm.sendMessage.mockReturnValue(fakeStream());

    await handlers.get(IPC.AGENT_SEND_MESSAGE)!(mockEvent, 'thread-1', 'hi');

    // Each chunk forwarded
    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STREAM_CHUNK, {
      threadId: 'thread-1',
      message: chunks[0],
    });
    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STREAM_CHUNK, {
      threadId: 'thread-1',
      message: chunks[1],
    });
    // End event
    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STREAM_END, 'thread-1');
  });

  it('AGENT_SEND_MESSAGE error → sends error event', async () => {
    async function* failingStream(): AsyncGenerator<any> {
      throw new Error('boom');
    }
    tm.sendMessage.mockReturnValue(failingStream());

    await handlers.get(IPC.AGENT_SEND_MESSAGE)!(mockEvent, 'thread-1', 'hi');

    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STREAM_ERROR, 'boom');
  });

  it('AGENT_SEND_MESSAGE with no window → returns early', async () => {
    getWindow = () => null;
    // Re-register with null window getter
    handlers.clear();
    registerIpcHandlers(tm as any, getWindow as any);

    async function* fakeStream() {
      yield { role: 'assistant', content: 'x' };
    }
    tm.sendMessage.mockReturnValue(fakeStream());

    await handlers.get(IPC.AGENT_SEND_MESSAGE)!(mockEvent, 'thread-1', 'hi');
    expect(mockWebContentsSend).not.toHaveBeenCalled();
  });

  it('AGENT_ABORT → calls abortAgent', async () => {
    await handlers.get(IPC.AGENT_ABORT)!(mockEvent, 'thread-1');
    expect(tm.abortAgent).toHaveBeenCalledWith('thread-1');
  });

  // ── Stream delta / state change forwarding ──────────────────────────

  it('onStreamDelta → forwards to window.webContents.send', () => {
    expect(tm.onStreamDelta).toBeTypeOf('function');
    tm.onStreamDelta('thread-1', { type: 'delta', content: 'x' });
    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STREAM_DELTA, {
      threadId: 'thread-1',
      event: { type: 'delta', content: 'x' },
    });
  });

  it('onStreamDelta with no window → does not throw', () => {
    handlers.clear();
    const nullGetWindow = () => null;
    registerIpcHandlers(tm as any, nullGetWindow as any);

    expect(() => tm.onStreamDelta('thread-1', {})).not.toThrow();
  });

  it('onStateChange → forwards to window.webContents.send', () => {
    expect(tm.onStateChange).toBeTypeOf('function');
    const event = { threadId: 'thread-1', state: 'running' };
    tm.onStateChange(event);
    expect(mockWebContentsSend).toHaveBeenCalledWith(IPC.AGENT_STATE_CHANGE, event);
  });

  // ── File handlers ───────────────────────────────────────────────────

  it('FILE_OPEN_PROJECT → calls dialog, returns path', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/home/user/project'],
    });

    const result = await handlers.get(IPC.FILE_OPEN_PROJECT)!(mockEvent);

    expect(mockDialog.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory'],
      title: 'Open Project',
    });
    expect(result).toBe('/home/user/project');
  });

  it('FILE_OPEN_PROJECT canceled → returns null', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await handlers.get(IPC.FILE_OPEN_PROJECT)!(mockEvent);
    expect(result).toBeNull();
  });

  it('FILE_COMMIT → execAsync success → returns { success: true }', async () => {
    setupExec({ stdout: '1 file changed' });

    const result = await handlers.get(IPC.FILE_COMMIT)!(mockEvent, 'fix bug');

    expect(result).toEqual({ success: true, output: '1 file changed' });
  });

  it('FILE_COMMIT error → returns { success: false }', async () => {
    setupExec(new Error('git failed'));

    const result = await handlers.get(IPC.FILE_COMMIT)!(mockEvent, 'fix');
    expect(result).toEqual({ success: false, error: 'git failed' });
  });

  it('file:readFile → reads file, returns content', async () => {
    mockReadFile.mockResolvedValue('file contents here');

    const result = await handlers.get('file:readFile')!(mockEvent, '/tmp/test.ts');

    expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.ts', 'utf-8');
    expect(result).toBe('file contents here');
  });

  it('file:readFile error → returns error string', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await handlers.get('file:readFile')!(mockEvent, '/nope');
    expect(result).toBe('Error: Cannot read file');
  });

  it('file:listFiles → returns sorted entries (dirs first, then alpha)', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'zeta.ts', isDirectory: () => false },
      { name: 'alpha', isDirectory: () => true },
      { name: 'beta.ts', isDirectory: () => false },
      { name: '.hidden', isDirectory: () => false },
      { name: 'node_modules', isDirectory: () => true },
    ]);

    const result = await handlers.get('file:listFiles')!(mockEvent, '/project');

    expect(mockReaddir).toHaveBeenCalledWith('/project', { withFileTypes: true });
    // .hidden and node_modules filtered out, dirs first, alpha-sorted
    expect(result).toEqual([
      { name: 'alpha', isDirectory: true },
      { name: 'beta.ts', isDirectory: false },
      { name: 'zeta.ts', isDirectory: false },
    ]);
  });

  it('file:listFiles error → returns empty array', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));

    const result = await handlers.get('file:listFiles')!(mockEvent, '/nope');
    expect(result).toEqual([]);
  });

  // ── Git diff stats ──────────────────────────────────────────────────

  it('GIT_DIFF_STATS → parses insertions and deletions', async () => {
    setupExec({
      stdout: ' src/foo.ts | 10 ++++---\n 1 file changed, 7 insertions(+), 3 deletions(-)\n',
    });

    const result = await handlers.get(IPC.GIT_DIFF_STATS)!(mockEvent);
    expect(result).toEqual({ added: 7, removed: 3 });
  });

  it('GIT_DIFF_STATS error → returns zeros', async () => {
    setupExec(new Error('not a git repo'));

    const result = await handlers.get(IPC.GIT_DIFF_STATS)!(mockEvent);
    expect(result).toEqual({ added: 0, removed: 0 });
  });
});
