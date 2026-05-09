import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadMemory, MemoryStore, buildMemoryPrelude } from '@/agent/memory';

describe('memory subsystem', () => {
  let tempHome: string;
  let projectDir: string;
  const originalEnv = process.env.TINY_CODEX_HOME;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'tinycdx-mem-'));
    projectDir = mkdtempSync(join(tmpdir(), 'tinycdx-proj-'));
    process.env.TINY_CODEX_HOME = tempHome;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TINY_CODEX_HOME;
    else process.env.TINY_CODEX_HOME = originalEnv;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe('loadMemory', () => {
    it('returns empty snapshot when no files exist', async () => {
      const snap = await loadMemory(projectDir);
      expect(snap.env).toBe('');
      expect(snap.user).toBe('');
      expect(snap.paths.globalEnv).toBe(join(tempHome, 'memory', 'MEMORY.md'));
      expect(snap.paths.globalUser).toBe(join(tempHome, 'memory', 'USER.md'));
      expect(snap.paths.projectEnv).toBe(join(projectDir, '.codex', 'memory', 'MEMORY.md'));
    });

    it('layers project memory after global memory', async () => {
      const fs = await import('fs/promises');
      await fs.mkdir(join(tempHome, 'memory'), { recursive: true });
      await fs.writeFile(join(tempHome, 'memory', 'MEMORY.md'), 'global rule one');
      await fs.mkdir(join(projectDir, '.codex', 'memory'), { recursive: true });
      await fs.writeFile(join(projectDir, '.codex', 'memory', 'MEMORY.md'), 'project rule two');
      const snap = await loadMemory(projectDir);
      expect(snap.env).toContain('global rule one');
      expect(snap.env).toContain('project rule two');
      expect(snap.env.indexOf('global rule one')).toBeLessThan(snap.env.indexOf('project rule two'));
    });
  });

  describe('MemoryStore', () => {
    it('writes a new MEMORY.md with env header', async () => {
      const snap = await loadMemory(projectDir);
      const store = new MemoryStore(snap);
      await store.append('env', 'project uses pnpm');
      const content = readFileSync(snap.paths.globalEnv, 'utf-8');
      expect(content).toMatch(/# Environment Memory/);
      expect(content).toContain('project uses pnpm');
    });

    it('writes USER.md with LOCAL ONLY header', async () => {
      const snap = await loadMemory(projectDir);
      const store = new MemoryStore(snap);
      await store.append('user', 'prefers Chinese in casual chat');
      const content = readFileSync(snap.paths.globalUser, 'utf-8');
      expect(content).toContain('<!-- LOCAL ONLY -->');
      expect(content).toContain('prefers Chinese in casual chat');
    });

    it('serialises concurrent appends without losing lines', async () => {
      const snap = await loadMemory(projectDir);
      const store = new MemoryStore(snap);
      const writes = Array.from({ length: 20 }, (_, i) => store.append('env', `entry ${i}`));
      await Promise.all(writes);
      const content = readFileSync(snap.paths.globalEnv, 'utf-8');
      for (let i = 0; i < 20; i++) {
        expect(content).toContain(`entry ${i}`);
      }
    });

    it('skips empty append', async () => {
      const snap = await loadMemory(projectDir);
      const store = new MemoryStore(snap);
      await store.append('env', '   ');
      expect(existsSync(snap.paths.globalEnv)).toBe(false);
    });
  });

  describe('buildMemoryPrelude', () => {
    it('emits placeholders when memory is empty', () => {
      const prelude = buildMemoryPrelude({
        env: '',
        user: '',
        paths: { globalEnv: '/x', globalUser: '/y', projectEnv: null },
      });
      expect(prelude).toContain('Environment Memory');
      expect(prelude).toContain('User Profile');
      expect(prelude).toContain('(none yet)');
    });

    it('renders env and user content inline', () => {
      const prelude = buildMemoryPrelude({
        env: 'env line',
        user: 'user line',
        paths: { globalEnv: '/x', globalUser: '/y', projectEnv: null },
      });
      expect(prelude).toContain('env line');
      expect(prelude).toContain('user line');
      expect(prelude).toContain('frozen="true"');
    });
  });
});
