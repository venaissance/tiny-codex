import { config } from 'dotenv';
import { resolve } from 'path';
// Load .env from project root before anything else
config({ path: resolve(__dirname, '../../..', '.env') });

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { createMainWindow } from './window';
import { Database } from './db';
import { ThreadManager } from './thread-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { OpenAIModelProvider } from '../community/openai/provider';
import { AnthropicModelProvider } from '../community/anthropic/provider';
import { MockModelProvider } from '../community/mock/provider';
import type { ModelProvider } from '../foundation/models/provider';

let mainWindow: BrowserWindow | null = null;
let db: Database;

app.whenReady().then(async () => {
  const dbPath = join(app.getPath('userData'), 'tiny-codex.db');
  db = new Database(dbPath);
  await db.ensureReady();

  // Configure providers from environment
  const providers = new Map<string, ModelProvider>();

  // E2E Mock mode — instant responses, no API calls
  if (process.env.E2E_MOCK === '1') {
    const mock = new MockModelProvider();
    providers.set('anthropic', mock);
    providers.set('openai', mock);
    console.log('[tiny-codex] Using MOCK provider (E2E_MOCK=1)');
  } else {

  // MiniMax — Anthropic 兼容模式（推荐）
  if (process.env.MINIMAX_API_KEY) {
    providers.set('anthropic', new AnthropicModelProvider({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: process.env.MINIMAX_ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic',
    }));
    // Also register as openai fallback via OpenAI compat
    providers.set('openai', new OpenAIModelProvider({
      baseURL: process.env.MINIMAX_OPENAI_BASE_URL || 'https://api.minimaxi.com/v1',
      apiKey: process.env.MINIMAX_API_KEY,
    }));
  }

  // GLM — OpenAI 兼容模式
  if (process.env.GLM_API_KEY) {
    providers.set('openai', new OpenAIModelProvider({
      baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
      apiKey: process.env.GLM_API_KEY,
    }));
  }

  // Doubao/ARK — OpenAI 兼容模式
  if (process.env.ARK_API_KEY) {
    providers.set('openai', new OpenAIModelProvider({
      baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: process.env.ARK_API_KEY,
    }));
  }

  // Native OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.set('openai', new OpenAIModelProvider({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    }));
  }

  // Native Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    providers.set('anthropic', new AnthropicModelProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }));
  }

  } // end else (non-mock)

  // Diagnostic: log configured providers
  console.log(`[tiny-codex] Providers configured: ${[...providers.keys()].join(', ') || 'NONE'}`);
  if (providers.size === 0) {
    console.warn('[tiny-codex] No API keys found! Set MINIMAX_API_KEY, GLM_API_KEY, or OPENAI_API_KEY in your shell env.');
  }

  const threadManager = new ThreadManager(db, providers);

  registerIpcHandlers(threadManager, () => mainWindow);

  mainWindow = createMainWindow();
  mainWindow.on('closed', () => { mainWindow = null; });

  // Default project: e2e_test_folder (if it exists)
  const defaultProject = join(__dirname, '../../..', 'e2e_test_folder');
  const fs = require('fs');
  if (fs.existsSync(defaultProject)) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('set-project-path', defaultProject);
    });
  }
});

app.on('window-all-closed', () => {
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
