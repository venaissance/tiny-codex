import { describe, it, expect, afterEach } from 'vitest';
import { strReplaceTool } from '@/coding/tools/str-replace';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('str_replace tool', () => {
  const tmpDir = path.join(os.tmpdir(), 'tiny-codex-test-replace');
  const tmpFile = path.join(tmpDir, 'replace-test.ts');

  afterEach(async () => {
    try { await unlink(tmpFile); } catch {}
  });

  it('replaces a unique string in a file', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpFile, 'const x = 1;\nconst y = 2;\n');

    await strReplaceTool.invoke({
      path: tmpFile,
      old_string: 'const x = 1;',
      new_string: 'const x = 42;',
    });

    const content = await readFile(tmpFile, 'utf-8');
    expect(content).toBe('const x = 42;\nconst y = 2;\n');
  });

  it('returns error when old_string not found', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpFile, 'hello world');

    const result = await strReplaceTool.invoke({
      path: tmpFile,
      old_string: 'nonexistent',
      new_string: 'replacement',
    });

    expect(result).toContain('not found');
  });
});
