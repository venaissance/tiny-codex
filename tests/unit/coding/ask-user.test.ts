import { describe, it, expect } from 'vitest';
import { askUserTool, setAskUserHandler } from '@/coding/tools/ask-user';

describe('ask_user tool', () => {
  it('uses default handler when no UI is set', async () => {
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toContain('No UI available');
    expect(result).toContain('What color?');
  });

  it('uses custom handler when set', async () => {
    setAskUserHandler(async (q) => `User answered: blue to "${q}"`);
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toBe('User answered: blue to "What color?"');

    // Reset
    setAskUserHandler(async (q) => `[No UI available] Question was: ${q}`);
  });
});
