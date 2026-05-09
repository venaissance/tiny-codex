/**
 * Memory snapshot frozen at session start.
 *
 * Memory is loaded ONCE at session start and injected into the system prompt.
 * Mid-session writes update the on-disk files but do NOT mutate the snapshot,
 * preserving prefix-cache and avoiding model confusion from shifting prompts.
 * The next session picks up the updates.
 */
export interface MemorySnapshot {
  /** Environment-side memory: tool tricks, project conventions, error patterns. */
  env: string;
  /** User-side memory: preferences, communication style, work habits. */
  user: string;
  /** Resolved file paths for write-back. */
  paths: {
    globalEnv: string;
    globalUser: string;
    projectEnv: string | null;
  };
}

export type MemoryTarget = 'env' | 'user';
