import { describe, it, expect } from 'vitest';
import { askUserTool, setAskUserHandler } from '@/coding/tools/ask-user';

describe('ask_user tool', () => {
  it('uses default handler when no UI is set', async () => {
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toContain('No UI available');
    expect(result).toContain('What color?');
  });

  it('uses custom handler when set', async () => {
    setAskUserHandler(async ({ question }) => `User answered: blue to "${question}"`);
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toBe('User answered: blue to "What color?"');

    // Reset
    setAskUserHandler(async ({ question }) => `[No UI available] Question was: ${question}`);
  });

  it('passes options to handler', async () => {
    let receivedOptions: any;
    setAskUserHandler(async ({ question, options }) => {
      receivedOptions = options;
      return options?.[0]?.value ?? question;
    });

    const result = await askUserTool.invoke({
      question: 'Pick a direction',
      options: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ],
    });

    expect(result).toBe('a');
    expect(receivedOptions).toHaveLength(2);
    expect(receivedOptions[0]).toEqual({ label: 'Option A', value: 'a' });

    // Reset
    setAskUserHandler(async ({ question }) => `[No UI available] Question was: ${question}`);
  });
});
