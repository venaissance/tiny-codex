import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '@/main/db';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('Database', () => {
  let tmpDir: string;
  let db: Database;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-db-'));
    db = new Database(join(tmpDir, 'test.db'));
    await db.ensureReady();
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('threads', () => {
    it('creates and retrieves a thread', () => {
      const id = db.createThread({ title: 'Test Thread', projectPath: '/tmp/project', modelId: 'gpt-4o', mode: 'local' });
      const thread = db.getThread(id);
      expect(thread).toBeDefined();
      expect(thread!.title).toBe('Test Thread');
      expect(thread!.mode).toBe('local');
    });

    it('lists all threads sorted by updated_at desc', () => {
      db.createThread({ title: 'First', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.createThread({ title: 'Second', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      const threads = db.listThreads();
      expect(threads).toHaveLength(2);
    });

    it('deletes a thread and its messages', () => {
      const id = db.createThread({ title: 'ToDelete', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.addMessage(id, { role: 'user', content: [{ type: 'text', text: 'hi' }] });
      db.deleteThread(id);
      expect(db.getThread(id)).toBeNull();
      expect(db.getMessages(id)).toHaveLength(0);
    });
  });

  describe('messages', () => {
    it('adds and retrieves messages for a thread', () => {
      const threadId = db.createThread({ title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.addMessage(threadId, { role: 'user', content: [{ type: 'text', text: 'hello' }] });
      db.addMessage(threadId, { role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
      const messages = db.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });
});
