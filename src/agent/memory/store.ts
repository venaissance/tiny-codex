import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import type { MemorySnapshot, MemoryTarget } from './types';

/**
 * MemoryStore handles append-only writes with atomic rename to avoid torn
 * writes when multiple review agents try to land memory at once. We never
 * truncate; old memory survives — sessions decide what to load via
 * loadMemory().
 *
 * USER.md privacy (Q4): every freshly-created USER.md gets a
 * "<!-- LOCAL ONLY -->" header. This header is **documentation, not
 * enforcement** — there is no runtime filter. The actual privacy guarantee
 * comes from the fact that v1 has no export/sync code path: USER.md lives at
 * ~/.tiny-codex/memory/USER.md (home dir, not inside any project), it is
 * loaded into the local session's system prompt only, and nothing serialises
 * it off-disk. If a future feature adds trajectory export, sync, or sharing,
 * it MUST add a real filter at that egress point — the comment header alone
 * will not stop it.
 */
export class MemoryStore {
  private readonly snapshot: MemorySnapshot;
  private readonly chain: Promise<void> = Promise.resolve();
  private tail: Promise<void> = Promise.resolve();

  constructor(snapshot: MemorySnapshot) {
    this.snapshot = snapshot;
  }

  paths() {
    return this.snapshot.paths;
  }

  /**
   * Append a single line to the chosen memory file. Creates the file with the
   * appropriate header if missing. Calls are serialised via an internal chain
   * to avoid lost writes under concurrency.
   */
  async append(target: MemoryTarget, line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    const path = target === 'user' ? this.snapshot.paths.globalUser : this.snapshot.paths.globalEnv;
    const next = this.tail.then(() => this.appendInternal(path, target, trimmed));
    this.tail = next.catch(() => {});
    return next;
  }

  private async appendInternal(filePath: string, target: MemoryTarget, line: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    let existing = '';
    try {
      existing = await readFile(filePath, 'utf-8');
    } catch {
      // File missing — leave empty, header will be added below.
    }

    if (!existing.trim()) {
      existing = renderHeader(target);
    } else if (!existing.endsWith('\n')) {
      existing += '\n';
    }

    const stamp = new Date().toISOString();
    const formatted = `- ${line.replace(/\s+$/g, '')} <!-- ${stamp} -->\n`;
    const next = existing + formatted;

    // Atomic rename: write to <file>.<rand>.tmp first, then rename.
    const tmpPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmpPath, next, 'utf-8');
    await rename(tmpPath, filePath);
  }
}

function renderHeader(target: MemoryTarget): string {
  if (target === 'user') {
    return [
      '<!-- LOCAL ONLY -->',
      '<!-- This file is your tiny-codex user profile. It stays on this machine.',
      '     Never commit it to a repo and never include it in shared trajectories. -->',
      '# User Profile',
      '',
      '',
    ].join('\n');
  }
  return [
    '# Environment Memory',
    '<!-- Tool tips, project conventions, recurring error patterns. -->',
    '',
    '',
  ].join('\n');
}
