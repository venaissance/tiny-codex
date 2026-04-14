import { readdir } from 'fs/promises';
import { join } from 'path';
import type { AgentMiddleware } from '../middleware';
import { readSkillFrontMatter, type SkillFrontmatter } from './skill-reader';

export function createSkillsMiddleware(skillsDirs: string[]) {
  let skills: SkillFrontmatter[] = [];
  let requestedSkillName: string | null = null;

  const middleware: AgentMiddleware = {
    async beforeAgentRun() {
      skills = [];
      const seen = new Set<string>();
      for (const dir of skillsDirs) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillPath = join(dir, entry.name, 'SKILL.md');
            const frontmatter = await readSkillFrontMatter(skillPath);
            if (frontmatter && !seen.has(frontmatter.name)) {
              seen.add(frontmatter.name);
              skills.push({ ...frontmatter, path: skillPath });
            }
          }
        } catch {
          // skip
        }
      }
    },

    async beforeModel(context) {
      if (skills.length === 0) return;

      const skillList = skills.map((s) => ({
        name: s.name,
        description: s.description,
        path: s.path,
      }));

      let explicitBlock = '';
      if (requestedSkillName) {
        const match = skills.find((s) => s.name.toLowerCase() === requestedSkillName!.toLowerCase());
        if (match) {
          explicitBlock = `\n<explicit_skill_invocation>
The user explicitly selected the skill "${match.name}".
You MUST call read_file on "${match.path}" and follow its instructions before answering.
</explicit_skill_invocation>`;
        }
        // Reset after use — only applies to the first turn
        requestedSkillName = null;
      }

      return {
        prompt: context.prompt + `\n<skill_system>
You have access to skills — optimized workflows for specific tasks.
When a query matches a skill, call read_file on its path to load the full instructions.
${explicitBlock}
<skills>
${JSON.stringify(skillList, null, 2)}
</skills>
</skill_system>`,
      };
    },
  };

  return {
    middleware,
    setRequestedSkill(name: string | null) {
      requestedSkillName = name;
    },
  };
}
