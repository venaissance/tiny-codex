import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

export interface ThreadRow {
  id: string;
  title: string;
  project_path: string;
  model_id: string;
  mode: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  is_compact_boundary: number;
  created_at: number;
}

export class Database {
  private db!: SqlJsDatabase;
  private filePath: string;
  private ready: Promise<void>;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (existsSync(this.filePath)) {
      const buffer = readFileSync(this.filePath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this.migrate();
  }

  async ensureReady(): Promise<void> {
    await this.ready;
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_path TEXT NOT NULL,
        model_id TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        is_compact_boundary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at)`);
  }

  private save(): void {
    const data = this.db.export();
    writeFileSync(this.filePath, Buffer.from(data));
  }

  createThread(params: { id?: string; title: string; projectPath: string; modelId: string; mode: 'local' | 'worktree' }): string {
    const id = params.id || randomUUID();
    const now = Date.now();
    this.db.run(
      'INSERT INTO threads (id, title, project_path, model_id, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, params.title, params.projectPath, params.modelId, params.mode, now, now],
    );
    this.save();
    return id;
  }

  getThread(id: string): ThreadRow | null {
    const stmt = this.db.prepare('SELECT * FROM threads WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as ThreadRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  listThreads(): ThreadRow[] {
    const results: ThreadRow[] = [];
    const stmt = this.db.prepare('SELECT * FROM threads ORDER BY updated_at DESC');
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as ThreadRow);
    }
    stmt.free();
    return results;
  }

  deleteThread(id: string): void {
    this.db.run('DELETE FROM messages WHERE thread_id = ?', [id]);
    this.db.run('DELETE FROM threads WHERE id = ?', [id]);
    this.save();
  }

  addMessage(threadId: string, message: { role: string; content: unknown[] }): string {
    const id = randomUUID();
    const now = Date.now();
    this.db.run(
      'INSERT INTO messages (id, thread_id, role, content, is_compact_boundary, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [id, threadId, message.role, JSON.stringify(message.content), now],
    );
    this.db.run('UPDATE threads SET updated_at = ? WHERE id = ?', [now, threadId]);
    this.save();
    return id;
  }

  getMessages(threadId: string): Array<{ id: string; role: string; content: unknown[]; created_at: number }> {
    const results: Array<{ id: string; role: string; content: unknown[]; created_at: number }> = [];
    const stmt = this.db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC');
    stmt.bind([threadId]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as MessageRow;
      results.push({
        id: row.id,
        role: row.role,
        content: JSON.parse(row.content),
        created_at: row.created_at,
      });
    }
    stmt.free();
    return results;
  }

  close(): void {
    this.save();
    this.db.close();
  }
}
