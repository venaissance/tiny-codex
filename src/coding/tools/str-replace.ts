import { defineTool } from '../../foundation/tools';
import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';

export const strReplaceTool = defineTool({
  name: 'str_replace',
  description: 'Replace a string in a file. The old_string must be unique in the file.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('The exact string to replace'),
    new_string: z.string().describe('The replacement string'),
  }),
  invoke: async ({ path: filePath, old_string, new_string }) => {
    try {
      const content = await readFile(filePath, 'utf-8');
      if (!content.includes(old_string)) {
        return `Error: old_string not found in ${filePath}`;
      }
      const occurrences = content.split(old_string).length - 1;
      if (occurrences > 1) {
        return `Error: old_string found ${occurrences} times in ${filePath}. Must be unique.`;
      }
      const newContent = content.replace(old_string, new_string);
      await writeFile(filePath, newContent, 'utf-8');
      return `Replaced in ${filePath}`;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
