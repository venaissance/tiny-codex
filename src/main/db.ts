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

    // FTS5 mirror of messages.content. The base table uses TEXT id (uuid),
    // not rowid, so we cannot use SQLite's "external content" optimisation
    // safely without rebuilding rowid mapping. We instead maintain a plain
    // FTS5 table with explicit triggers that copy id+thread_id alongside
    // the content. This keeps search self-contained and survives migration.
    //
    // FTS5 isn't available on every sql.js build — guard the create so we
    // gracefully fall back to LIKE search when the extension is missing.
    this.fts5Available = this.tryCreateFts5();
  }

  private fts5Available = false;

  private tryCreateFts5(): boolean {
    try {
      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          message_id UNINDEXED,
          thread_id UNINDEXED,
          role UNINDEXED,
          created_at UNINDEXED,
          content,
          tokenize='unicode61 remove_diacritics 2'
        )
      `);
      // Backfill any messages that were inserted before fts5 came online.
      this.db.run(`
        INSERT INTO messages_fts (message_id, thread_id, role, created_at, content)
        SELECT m.id, m.thread_id, m.role, m.created_at, m.content
        FROM messages m
        WHERE NOT EXISTS (SELECT 1 FROM messages_fts f WHERE f.message_id = m.id)
      `);
      return true;
    } catch (err) {
      console.warn('[db] FTS5 unavailable, falling back to LIKE search:', err);
      return false;
    }
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
    if (this.fts5Available) {
      try {
        this.db.run('DELETE FROM messages_fts WHERE thread_id = ?', [id]);
      } catch (err) {
        console.warn('[db] fts5 delete failed:', err);
      }
    }
    this.db.run('DELETE FROM threads WHERE id = ?', [id]);
    this.save();
  }

  addMessage(threadId: string, message: { role: string; content: unknown[] }): string {
    const id = randomUUID();
    const now = Date.now();
    const contentJson = JSON.stringify(message.content);
    this.db.run(
      'INSERT INTO messages (id, thread_id, role, content, is_compact_boundary, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [id, threadId, message.role, contentJson, now],
    );
    if (this.fts5Available) {
      try {
        this.db.run(
          'INSERT INTO messages_fts (message_id, thread_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)',
          [id, threadId, message.role, now, contentJson],
        );
      } catch (err) {
        // fts5 hiccup must not break message insertion
        console.warn('[db] fts5 insert failed:', err);
      }
    }
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

  /**
   * Full-text search across all messages.
   *
   * Routing:
   *   - If FTS5 is available AND the query has no CJK characters, use the
   *     FTS5 MATCH operator with snippet() to return highlighted excerpts.
   *   - Otherwise fall back to a plain LIKE scan. CJK falls back because
   *     SQLite's default unicode61 tokenizer splits CJK on every codepoint,
   *     producing useless results; the LIKE path is slower but correct.
   */
  searchMessages(query: string, limit = 50): Array<{
    threadId: string;
    messageId: string;
    role: string;
    snippet: string;
    createdAt: number;
  }> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const useFts = this.fts5Available && !containsCJK(trimmed);
    if (useFts) {
      const out: Array<{ threadId: string; messageId: string; role: string; snippet: string; createdAt: number }> = [];
      const stmt = this.db.prepare(
        `SELECT thread_id, message_id, role, created_at,
                snippet(messages_fts, 4, '<mark>', '</mark>', '...', 12) AS snip
         FROM messages_fts WHERE messages_fts MATCH ?
         ORDER BY rank LIMIT ?`,
      );
      try {
        stmt.bind([sanitiseFtsQuery(trimmed), limit]);
        while (stmt.step()) {
          const row = stmt.getAsObject() as any;
          out.push({
            threadId: row.thread_id,
            messageId: row.message_id,
            role: row.role,
            snippet: extractTextSnippet(row.snip),
            createdAt: row.created_at,
          });
        }
      } finally {
        stmt.free();
      }
      return out;
    }

    // LIKE fallback. Lowercase compare for ASCII; CJK survives unchanged.
    const out: Array<{ threadId: string; messageId: string; role: string; snippet: string; createdAt: number }> = [];
    const stmt = this.db.prepare(
      `SELECT thread_id, id, role, created_at, content FROM messages
       WHERE LOWER(content) LIKE ? ORDER BY created_at DESC LIMIT ?`,
    );
    try {
      stmt.bind([`%${trimmed.toLowerCase()}%`, limit]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        out.push({
          threadId: row.thread_id,
          messageId: row.id,
          role: row.role,
          snippet: makeLikeSnippet(row.content, trimmed),
          createdAt: row.created_at,
        });
      }
    } finally {
      stmt.free();
    }
    return out;
  }

  close(): void {
    this.save();
    this.db.close();
  }
}

function containsCJK(s: string): boolean {
  return /[\u3400-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s);
}

/**
 * Strip FTS5 metacharacters from arbitrary user input. We only support a
 * single phrase query for v1 — power users can chain quoted phrases later.
 */
function sanitiseFtsQuery(q: string): string {
  // Replace any character that has special meaning in FTS5 syntax with space,
  // then wrap in quotes for phrase matching.
  const cleaned = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '""';
  return `"${cleaned}"`;
}

/**
 * The fts5 content column stores a JSON serialised content array (the raw
 * message). The snippet() output is therefore JSON-noise + the query.
 * Strip the obvious JSON wrappers and trim.
 */
function extractTextSnippet(snip: string): string {
  if (!snip) return '';
  return snip
    .replace(/\\"/g, '"')
    .replace(/[{}\[\]]/g, ' ')
    .replace(/"type":\s*"\w+",?/g, '')
    .replace(/"text":\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort snippet generator for the LIKE path. Pulls 60 chars on either
 * side of the first occurrence in the JSON content.
 */
function makeLikeSnippet(jsonContent: string, query: string): string {
  const idx = jsonContent.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return jsonContent.slice(0, 200);
  const start = Math.max(0, idx - 60);
  const end = Math.min(jsonContent.length, idx + query.length + 60);
  const slice = jsonContent.slice(start, end);
  return (start > 0 ? '...' : '') + slice + (end < jsonContent.length ? '...' : '');
}
