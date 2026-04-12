import { defineTool } from '../../foundation/tools';
import { z } from 'zod';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';

async function globRecursive(dir: string, pattern: RegExp, results: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      await globRecursive(fullPath, pattern, results);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

export const globTool = defineTool({
  name: 'glob',
  description: 'Search for files matching a pattern.',
  parameters: z.object({
    pattern: z.string().describe('File name pattern (e.g., "*.tsx", "*.md")'),
    cwd: z.string().describe('Directory to search in'),
  }),
  invoke: async ({ pattern, cwd }) => {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      const files = await globRecursive(cwd, regex);
      if (files.length === 0) return 'No matches found.';
      return files.map((f) => relative(cwd, f)).join('\n');
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
