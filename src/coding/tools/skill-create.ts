import { z } from 'zod';
import { defineTool } from '../../foundation/tools';
import { writePendingSkill } from '../../agent/skills/skill-pending';

const SCHEMA = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]{2,40}$/)
    .describe('kebab-case, 3-41 chars, must start with a letter'),
  description: z
    .string()
    .min(1)
    .max(200)
    .describe('When to use this skill, in <=200 chars. Should be highly specific so users can decide whether to keep it.'),
  triggers: z
    .array(z.string().min(2))
    .min(1)
    .max(8)
    .describe('User-phrasing triggers (e.g. ["fix flaky test", "investigate timeout"])'),
  body: z
    .string()
    .min(20)
    .max(8000)
    .describe('Markdown body. State the workflow steps directly. No code that calls external networks or destructive shell commands.'),
});

export type SkillCreateInput = z.infer<typeof SCHEMA>;

/**
 * skill_create — agent-callable tool that proposes a new skill.
 *
 * Per Q3 the skill lands in ~/.tiny-codex/skills/_pending/<name>/SKILL.md and
 * stays inactive until the user explicitly approves it via the
 * skill:confirm IPC channel. This avoids two failure modes:
 *   1. Self-poisoning loops where a low-quality skill keeps re-triggering.
 *   2. Prompt injection from an external doc convincing the agent to install
 *      a malicious skill silently.
 */
export function createSkillCreateTool() {
  return defineTool({
    name: 'skill_create',
    description:
      'Propose a NEW reusable skill based on a non-trivial workflow you just used. The skill goes to a pending queue for the user to approve; it is NOT activated immediately. Only call this if the workflow is genuinely reusable across future sessions.',
    parameters: SCHEMA,
    invoke: async (input: SkillCreateInput) => {
      const result = await writePendingSkill(input);
      if (!result.ok) {
        return `skill_create rejected: ${result.error}`;
      }
      return `skill_create OK: pending at ${result.path} (awaiting user approval)`;
    },
  });
}
