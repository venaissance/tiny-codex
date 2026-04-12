import { describe, it, expect } from 'vitest';
import { readFileTool } from '@/coding/tools/read-file';
import path from 'path';

describe('read_file tool', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-project');

  it('reads an existing file', async () => {
    const result = await readFileTool.invoke({
      path: path.join(fixturesDir, 'src/Button.tsx'),
    });
    expect(result).toContain('ButtonProps');
    expect(result).toContain('export function Button');
  });

  it('returns error for non-existent file', async () => {
    const result = await readFileTool.invoke({
      path: path.join(fixturesDir, 'nonexistent.ts'),
    });
    expect(result).toContain('Error');
  });
});
