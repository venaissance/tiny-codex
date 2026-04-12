import { defineTool } from '../../foundation/tools';
import { spawn } from 'child_process';
import { z } from 'zod';

export const grepTool = defineTool({
  name: 'grep',
  description: 'Search file contents for a regex pattern.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().describe('File or directory to search'),
  }),
  invoke: async ({ pattern, path: searchPath }) => {
    return new Promise<string>((resolve) => {
      const proc = spawn('grep', ['-rn', pattern, searchPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('close', () => {
        resolve(output.trim() || 'No matches found.');
      });
      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  },
});
