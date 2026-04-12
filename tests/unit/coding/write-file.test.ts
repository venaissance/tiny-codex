import { describe, it, expect, afterEach } from 'vitest';
import { writeFileTool } from '@/coding/tools/write-file';
import { readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('write_file tool', () => {
  const tmpDir = path.join(os.tmpdir(), 'tiny-codex-test-write');
  const tmpFile = path.join(tmpDir, 'test-output.ts');

  afterEach(async () => {
    try { await unlink(tmpFile); } catch {}
  });

  it('writes content to a new file', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFileTool.invoke({ path: tmpFile, content: 'export const x = 1;' });
    const content = await readFile(tmpFile, 'utf-8');
    expect(content).toBe('export const x = 1;');
  });
});
