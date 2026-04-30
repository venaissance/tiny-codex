import { z } from 'zod';
import { defineTool } from '../../foundation/tools';
import { MemoryStore, type MemoryTarget } from '../../agent/memory';

const SCHEMA = z.object({
  target: z.enum(['env', 'user']).describe(
    "'env' for environment memory (tool tips, project conventions, recurring error patterns); 'user' for user profile (preferences, communication style, work habits).",
  ),
  line: z
    .string()
    .min(3)
    .max(280)
    .describe('A single high-density line. No filler words. State the fact directly.'),
});

/**
 * Memory-write tool. Created per-review so each review agent gets a closure
 * over its own MemoryStore (no global state).
 */
export function createMemoryWriteTool(store: MemoryStore) {
  return defineTool({
    name: 'memory_write',
    description:
      'Append ONE atomic line to long-term memory. Call multiple times for multiple facts. Each line should be a single self-contained, high-density observation worth remembering across sessions.',
    parameters: SCHEMA,
    invoke: async ({ target, line }: { target: MemoryTarget; line: string }) => {
      try {
        await store.append(target, line);
        return `OK memory written to ${target}: ${line.slice(0, 80)}`;
      } catch (err: any) {
        return `Error writing memory: ${err.message}`;
      }
    },
  });
}
