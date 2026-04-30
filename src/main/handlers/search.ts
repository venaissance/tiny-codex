import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { Database } from '../db';

/**
 * Cross-thread message search.
 *
 * The handler routes between FTS5 and LIKE inside Database.searchMessages.
 * Renderer-side just calls api.searchMessages(query) and gets a snippet
 * list back.
 */
export function registerSearchHandlers(db: Database): void {
  ipcMain.handle(IPC.SESSION_SEARCH, async (_event, query: string, limit?: number) => {
    if (!query || typeof query !== 'string') return [];
    return db.searchMessages(query, limit ?? 50);
  });
}
