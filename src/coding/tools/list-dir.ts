import { defineTool } from '../../foundation/tools';
import { readdir } from 'fs/promises';
import { z } from 'zod';

export const listDirTool = defineTool({
  name: 'list_dir',
  description: 'List contents of a directory.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the directory'),
  }),
  invoke: async ({ path: dirPath }) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((e) => {
        const prefix = e.isDirectory() ? '[dir]  ' : '[file] ';
        return prefix + e.name;
      });
      return lines.join('\n');
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
