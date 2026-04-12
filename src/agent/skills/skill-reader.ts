import matter from 'gray-matter';
import { readFile } from 'fs/promises';

export interface SkillFrontmatter {
  name: string;
  description: string;
  tools?: Array<{ name: string; description: string }>;
}

export async function readSkillFrontMatter(filePath: string): Promise<SkillFrontmatter | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const { data } = matter(content);
    return {
      name: data.name ?? 'unknown',
      description: data.description ?? '',
      tools: data.tools,
    };
  } catch {
    return null;
  }
}
