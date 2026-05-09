import { z } from 'zod';
import { defineTool } from '../../foundation/tools';
import { MemoryStore, type MemoryTarget } from '../../agent/memory';

const MAX_MEMORY_LINE_LENGTH = 500;

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
 * Patterns that block a memory line before it lands on disk (H2).
 * Mirrors the set used by skill-pending writePendingSkill: anything that
 * looks like a phone-home, destructive command, code-eval, hidden Unicode,
 * exfil channel, or permission bypass is rejected. This is a defence in
 * depth — the review agent's prompt already tells it not to write commands,
 * but a successful injection could override that. Hard-failing here gives
 * us a deterministic backstop.
 *
 * Exported for tests.
 */
export const MEMORY_DANGER_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /curl\s+[^\n|;`$]*\|\s*(?:bash|sh|zsh)/i, reason: 'curl-pipe-to-shell' },
  { re: /wget\s+[^\n|;`$]*\|\s*(?:bash|sh|zsh)/i, reason: 'wget-pipe-to-shell' },
  { re: /\brm\s+-rf?\s+(?:\/|~|\$HOME|\*)/i, reason: 'destructive-rm' },
  { re: /\beval\s*\(/i, reason: 'eval-call' },
  { re: /[\u200b\u200c\u200d\u2060\ufeff]/, reason: 'zero-width-char' },
  { re: /[\u202a-\u202e]/, reason: 'bidi-control-char' },
  { re: /\b(?:scp|nc|netcat)\b/i, reason: 'data-exfil-cmd' },
  { re: /--dangerously-skip-permissions/i, reason: 'permission-bypass' },
];

/**
 * Returns null if the line is safe to write, or a short reason string if
 * it should be rejected. Length cap is the hard ceiling: even after
 * truncation, attempted prompt-injection payloads tend to want headroom
 * to chain instructions, so we reject anything significantly longer than
 * a single fact.
 */
export function validateMemoryLine(line: string): string | null {
  if (line.length > MAX_MEMORY_LINE_LENGTH) {
    return `line too long (max ${MAX_MEMORY_LINE_LENGTH} chars)`;
  }
  for (const { re, reason } of MEMORY_DANGER_PATTERNS) {
    if (re.test(line)) return `rejected: ${reason}`;
  }
  return null;
}

/**
 * Memory-write tool. Created per-review so each review agent gets a closure
 * over its own MemoryStore (no global state).
 *
 * Defends against prompt-injected facts (H2): trajectory content fed to the
 * review agent is partially attacker-controlled (tool outputs, web scrapes,
 * etc.). If a malicious fact slips through the curator agent's filtering,
 * `validateMemoryLine` rejects obvious dangerous patterns before the line
 * gets persisted into MEMORY.md / USER.md (which are loaded into every
 * future session's system prompt).
 */
export function createMemoryWriteTool(store: MemoryStore) {
  return defineTool({
    name: 'memory_write',
    description:
      'Append ONE atomic line to long-term memory. Call multiple times for multiple facts. Each line should be a single self-contained, high-density observation worth remembering across sessions.',
    parameters: SCHEMA,
    invoke: async ({ target, line }: { target: MemoryTarget; line: string }) => {
      const reject = validateMemoryLine(line);
      if (reject) {
        return `Error writing memory: ${reject}`;
      }
      try {
        await store.append(target, line);
        return `OK memory written to ${target}: ${line.slice(0, 80)}`;
      } catch (err: any) {
        return `Error writing memory: ${err.message}`;
      }
    },
  });
}
