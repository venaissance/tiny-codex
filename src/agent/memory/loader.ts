import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { MemorySnapshot } from './types';

const GLOBAL_DIR_ENV = 'TINY_CODEX_HOME';

/**
 * Resolve the global tiny-codex home dir.
 * Honours TINY_CODEX_HOME for testability; defaults to ~/.tiny-codex.
 */
export function resolveGlobalDir(): string {
  return process.env[GLOBAL_DIR_ENV] || join(homedir(), '.tiny-codex');
}

async function readOrEmpty(path: string): Promise<string> {
  try {
    return (await readFile(path, 'utf-8')).trim();
  } catch {
    return '';
  }
}

/**
 * Load memory once at session start (frozen snapshot).
 *
 * Layering rules:
 *   - Global MEMORY.md  + USER.md live in ~/.tiny-codex/memory/
 *   - Project MEMORY.md lives in <projectPath>/.codex/memory/
 *   - For env memory: project entries are appended AFTER the global entries
 *     (the model reads top-down; project specifics override generic ones at
 *     the bottom of the prompt section).
 *   - USER.md is ALWAYS global. Per Q4, USER.md must never leak through
 *     project-shareable paths.
 */
export async function loadMemory(projectPath?: string): Promise<MemorySnapshot> {
  const globalDir = resolveGlobalDir();
  const globalEnvPath = join(globalDir, 'memory', 'MEMORY.md');
  const globalUserPath = join(globalDir, 'memory', 'USER.md');
  const projectEnvPath = projectPath
    ? join(projectPath, '.codex', 'memory', 'MEMORY.md')
    : null;

  const [globalEnv, projectEnv, user] = await Promise.all([
    readOrEmpty(globalEnvPath),
    projectEnvPath ? readOrEmpty(projectEnvPath) : Promise.resolve(''),
    readOrEmpty(globalUserPath),
  ]);

  const envParts: string[] = [];
  if (globalEnv) envParts.push(globalEnv);
  if (projectEnv) {
    envParts.push(`<!-- project-scope: ${projectPath} -->\n${projectEnv}`);
  }

  return {
    env: envParts.join('\n\n').trim(),
    user: user.trim(),
    paths: {
      globalEnv: globalEnvPath,
      globalUser: globalUserPath,
      projectEnv: projectEnvPath,
    },
  };
}
