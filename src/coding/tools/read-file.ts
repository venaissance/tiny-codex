import { defineTool } from '../../foundation/tools';
import { readFile } from 'fs/promises';
import { z } from 'zod';

export const readFileTool = defineTool({
  name: 'read_file',
  description: 'Read a file from the filesystem. Returns file contents as text.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
  }),
  invoke: async ({ path: filePath }) => {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  },
});
