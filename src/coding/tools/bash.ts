import { defineTool } from '../../foundation/tools';
import { spawn } from 'child_process';
import { z } from 'zod';

const MAX_OUTPUT_CHARS = 16_000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  return (
    output.slice(0, MAX_OUTPUT_CHARS) +
    `\n\n[Output truncated: ${output.length} chars total, showing first ${MAX_OUTPUT_CHARS}. Use grep to search specific content.]`
  );
}

export const bashTool = defineTool({
  name: 'bash',
  description: 'Execute a bash command in the shell. Returns stdout or stderr.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
  invoke: async ({ command }) => {
    return new Promise<string>((resolve) => {
      const proc = spawn(process.env.SHELL ?? 'bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30 * 60 * 1000,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        const raw = code === 0 ? stdout : (stderr || `Command exited with code ${code}`);
        resolve(truncateOutput(raw));
      });
      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  },
});
