import { describe, it, expect } from 'vitest';
import { readSkillFrontMatter } from '@/agent/skills/skill-reader';
import path from 'path';

describe('Skills System', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-skills');

  describe('readSkillFrontMatter', () => {
    it('parses SKILL.md frontmatter', async () => {
      const skillPath = path.join(fixturesDir, 'test-skill/SKILL.md');
      const result = await readSkillFrontMatter(skillPath);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('test-skill');
      expect(result!.description).toBe('A test skill for unit tests');
    });

    it('returns null for non-existent file', async () => {
      const result = await readSkillFrontMatter('/nonexistent/SKILL.md');
      expect(result).toBeNull();
    });
  });
});
