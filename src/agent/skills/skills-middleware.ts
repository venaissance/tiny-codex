import { readdir } from 'fs/promises';
import { join } from 'path';
import type { AgentMiddleware } from '../middleware';
import { readSkillFrontMatter, type SkillFrontmatter } from './skill-reader';

export function createSkillsMiddleware(skillsDirs: string[]): AgentMiddleware {
  let skills: SkillFrontmatter[] = [];

  return {
    async beforeAgentRun() {
      skills = [];
      for (const dir of skillsDirs) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillPath = join(dir, entry.name, 'SKILL.md');
            const frontmatter = await readSkillFrontMatter(skillPath);
            if (frontmatter) skills.push(frontmatter);
          }
        } catch {
          // skip
        }
      }
    },

    async beforeModel(context) {
      if (skills.length === 0) return;
      const skillList = JSON.stringify(skills.map((s) => ({ name: s.name, description: s.description })));
      return {
        prompt: context.prompt + '\n<skills>' + skillList + '</skills>',
      };
    },
  };
}
