import type { MemorySnapshot } from './types';

/**
 * Build the system-prompt prelude that injects the frozen memory snapshot
 * ahead of any project-level AGENTS.md content.
 *
 * Empty memory is rendered as a compact "(none yet)" hint so the model knows
 * the system is wired but unused — without burning tokens on a long header.
 */
export function buildMemoryPrelude(memory: MemorySnapshot): string {
  const env = memory.env || '(none yet)';
  const user = memory.user || '(none yet)';
  return [
    '<memory_snapshot frozen="true">',
    '## Environment Memory',
    env,
    '',
    '## User Profile',
    user,
    '</memory_snapshot>',
  ].join('\n');
}
