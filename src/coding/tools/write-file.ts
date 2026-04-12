import { defineTool } from '../../foundation/tools';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { z } from 'zod';

export const writeFileTool = defineTool({
  name: 'write_file',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  invoke: async ({ path: filePath, content }) => {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
      return `File written: ${filePath}`;
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  },
});
