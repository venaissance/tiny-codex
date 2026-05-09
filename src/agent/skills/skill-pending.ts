import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { resolveGlobalDir } from '../memory/loader';

export interface PendingSkill {
  name: string;
  description: string;
  triggers: string[];
  bodyExcerpt: string;
  path: string;
  pendingDir: string;
  createdAt: number;
}

const SKILL_NAME_RE = /^[a-z][a-z0-9-]{2,40}$/;

/**
 * Patterns that block a skill body before it can land in the pending directory.
 * The list is intentionally small and surgical — we are protecting the
 * harness, not building a full prompt-injection scanner. Anything obviously
 * trying to phone home, wipe disks, smuggle code via eval, or hide payloads
 * via zero-width Unicode gets rejected.
 */
const SECURITY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /curl\s+[^\n|;`$]*\|\s*(?:bash|sh|zsh)/i, reason: 'curl-pipe-to-shell' },
  { re: /wget\s+[^\n|;`$]*\|\s*(?:bash|sh|zsh)/i, reason: 'wget-pipe-to-shell' },
  { re: /\brm\s+-rf?\s+(?:\/|~|\$HOME|\*)/i, reason: 'destructive-rm' },
  { re: /\beval\s*\(/i, reason: 'eval-call' },
  { re: /[\u200b\u200c\u200d\u2060\ufeff]/, reason: 'zero-width-char' },
  { re: /[\u202a-\u202e]/, reason: 'bidi-control-char' },
  { re: /\b(?:scp|nc|netcat)\b/i, reason: 'data-exfil-cmd' },
  { re: /--dangerously-skip-permissions/i, reason: 'permission-bypass' },
];

export interface SkillCreateRequest {
  name: string;
  description: string;
  triggers: string[];
  body: string;
}

export interface SkillCreateResult {
  ok: boolean;
  /** Path written when ok=true */
  path?: string;
  /** Reason when ok=false */
  error?: string;
}

export function pendingSkillsRoot(): string {
  return join(resolveGlobalDir(), 'skills', '_pending');
}

export function activeSkillsRoot(): string {
  return join(resolveGlobalDir(), 'skills');
}

/**
 * Validate the request and return either an error string or null.
 * Exported for unit tests.
 */
export function validateSkillRequest(req: SkillCreateRequest): string | null {
  if (!SKILL_NAME_RE.test(req.name)) {
    return 'name must match ^[a-z][a-z0-9-]{2,40}$';
  }
  if (!req.description || req.description.length === 0) {
    return 'description is required';
  }
  if (req.description.length > 200) {
    return 'description must be <=200 chars';
  }
  if (!req.triggers?.length) {
    return 'at least one trigger is required';
  }
  if (!req.body || req.body.trim().length < 20) {
    return 'body too short (min 20 chars)';
  }
  for (const { re, reason } of SECURITY_PATTERNS) {
    if (re.test(req.body)) return `body rejected: ${reason}`;
  }
  return null;
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Write a pending skill to ~/.tiny-codex/skills/_pending/<name>/SKILL.md.
 *
 * Pending location is enforced by Q3: agent-created skills must NEVER land in
 * the active skills directory without explicit user confirmation. Pending
 * skills are NOT loaded by the skills-middleware.
 */
export async function writePendingSkill(req: SkillCreateRequest): Promise<SkillCreateResult> {
  const err = validateSkillRequest(req);
  if (err) return { ok: false, error: err };

  const pendingRoot = pendingSkillsRoot();
  const activeRoot = activeSkillsRoot();
  const pendingDir = join(pendingRoot, req.name);
  const activeDir = join(activeRoot, req.name);

  if (await dirExists(pendingDir)) {
    return { ok: false, error: `pending skill "${req.name}" already exists` };
  }
  if (await dirExists(activeDir)) {
    return { ok: false, error: `skill "${req.name}" already active` };
  }

  await mkdir(pendingDir, { recursive: true });

  const frontmatter = [
    '---',
    `name: ${req.name}`,
    `description: ${escapeYaml(req.description)}`,
    `triggers:`,
    ...req.triggers.map((t) => `  - ${escapeYaml(t)}`),
    `created_by: agent`,
    `created_at: ${new Date().toISOString()}`,
    'pending: true',
    '---',
    '',
  ].join('\n');

  const filePath = join(pendingDir, 'SKILL.md');
  await writeFile(filePath, frontmatter + req.body.trim() + '\n', 'utf-8');
  return { ok: true, path: filePath };
}

function escapeYaml(s: string): string {
  if (/[":#\n]/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

export async function listPendingSkills(): Promise<PendingSkill[]> {
  const root = pendingSkillsRoot();
  let entries: import('fs').Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: PendingSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(root, entry.name, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf-8');
      const meta = parsePendingFrontmatter(content);
      out.push({
        name: meta.name || entry.name,
        description: meta.description || '',
        triggers: meta.triggers || [],
        bodyExcerpt: extractBodyExcerpt(content),
        path: skillPath,
        pendingDir: join(root, entry.name),
        createdAt: meta.createdAt || 0,
      });
    } catch {
      // skip unreadable
    }
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

interface FrontmatterMeta {
  name?: string;
  description?: string;
  triggers?: string[];
  createdAt?: number;
}

function parsePendingFrontmatter(content: string): FrontmatterMeta {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const meta: FrontmatterMeta = { triggers: [] };
  const lines = match[1].split('\n');
  let inTriggers = false;
  for (const line of lines) {
    if (/^triggers:\s*$/.test(line)) {
      inTriggers = true;
      continue;
    }
    if (inTriggers) {
      const t = line.match(/^\s*-\s*(.*)$/);
      if (t) {
        meta.triggers!.push(stripQuotes(t[1].trim()));
        continue;
      }
      inTriggers = false;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = stripQuotes(kv[2].trim());
    if (key === 'name') meta.name = value;
    else if (key === 'description') meta.description = value;
    else if (key === 'created_at') {
      const ts = Date.parse(value);
      if (!Number.isNaN(ts)) meta.createdAt = ts;
    }
  }
  return meta;
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

function extractBodyExcerpt(content: string): string {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  return body.slice(0, 200);
}

export async function confirmPendingSkill(name: string): Promise<{ ok: boolean; error?: string; path?: string }> {
  if (!SKILL_NAME_RE.test(name)) return { ok: false, error: 'invalid skill name' };
  const from = join(pendingSkillsRoot(), name);
  const to = join(activeSkillsRoot(), name);
  if (!(await dirExists(from))) {
    return { ok: false, error: `pending skill "${name}" not found` };
  }
  if (await dirExists(to)) {
    return { ok: false, error: `skill "${name}" already exists in active dir` };
  }
  await mkdir(activeSkillsRoot(), { recursive: true });
  await rename(from, to);
  return { ok: true, path: to };
}

export async function rejectPendingSkill(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!SKILL_NAME_RE.test(name)) return { ok: false, error: 'invalid skill name' };
  const dir = join(pendingSkillsRoot(), name);
  if (!(await dirExists(dir))) return { ok: false, error: `pending skill "${name}" not found` };
  await rm(dir, { recursive: true, force: true });
  return { ok: true };
}

// re-export for convenience in tests
export { homedir };
