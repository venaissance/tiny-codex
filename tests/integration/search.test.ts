import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '@/main/db';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('Database.searchMessages', () => {
  let tmpDir: string;
  let db: Database;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-search-'));
    db = new Database(join(tmpDir, 'test.db'));
    await db.ensureReady();
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty for empty query', () => {
    expect(db.searchMessages('')).toEqual([]);
  });

  it('finds an ASCII keyword via FTS5 path', () => {
    const t1 = db.createThread({ title: 'A', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    const t2 = db.createThread({ title: 'B', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    db.addMessage(t1, { role: 'user', content: [{ type: 'text', text: 'How do I use ripgrep?' }] });
    db.addMessage(t2, { role: 'assistant', content: [{ type: 'text', text: 'Vitest is the runner here.' }] });
    db.addMessage(t1, { role: 'user', content: [{ type: 'text', text: 'unrelated text' }] });

    const hits = db.searchMessages('ripgrep');
    expect(hits.length).toBeGreaterThan(0);
    const threads = hits.map((h) => h.threadId);
    expect(threads).toContain(t1);
    expect(threads).not.toContain(t2);
    expect(hits[0].snippet.toLowerCase()).toContain('ripgrep');
  });

  it('falls back to LIKE for CJK input', () => {
    const t = db.createThread({ title: 'CN', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    db.addMessage(t, { role: 'user', content: [{ type: 'text', text: '今天天气真好' }] });
    db.addMessage(t, { role: 'assistant', content: [{ type: 'text', text: '是的 weather is nice' }] });

    const hits = db.searchMessages('天气');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].snippet).toContain('天气');
  });

  it('removes deleted threads from search', () => {
    const t = db.createThread({ title: 'X', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    db.addMessage(t, { role: 'user', content: [{ type: 'text', text: 'lonely-keyword-foo' }] });
    expect(db.searchMessages('lonely-keyword-foo')).toHaveLength(1);
    db.deleteThread(t);
    expect(db.searchMessages('lonely-keyword-foo')).toHaveLength(0);
  });

  it('respects limit argument', () => {
    const t = db.createThread({ title: 'X', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    for (let i = 0; i < 5; i++) {
      db.addMessage(t, { role: 'user', content: [{ type: 'text', text: `repeated-marker number ${i}` }] });
    }
    const hits = db.searchMessages('repeated-marker', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it('returns empty result for unmatched query', () => {
    const t = db.createThread({ title: 'X', projectPath: '/tmp', modelId: 'm', mode: 'local' });
    db.addMessage(t, { role: 'user', content: [{ type: 'text', text: 'totally unrelated text' }] });
    expect(db.searchMessages('nonexistent-search-term-zzz')).toHaveLength(0);
  });
});
