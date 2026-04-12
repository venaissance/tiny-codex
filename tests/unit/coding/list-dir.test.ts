import { describe, it, expect } from 'vitest';
import { listDirTool } from '@/coding/tools/list-dir';
import path from 'path';

describe('list_dir tool', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-project');

  it('lists directory contents', async () => {
    const result = await listDirTool.invoke({ path: fixturesDir });
    expect(result).toContain('src');
    expect(result).toContain('package.json');
  });

  it('returns error for non-existent directory', async () => {
    const result = await listDirTool.invoke({ path: '/nonexistent-dir-xyz' });
    expect(result).toContain('Error');
  });
});
