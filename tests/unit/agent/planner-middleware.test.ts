import { describe, it, expect, vi } from 'vitest';
import { PlannerMiddleware, parsePlanFromText, type PlanItem } from '@/agent/middlewares/planner';
import type { ModelContext } from '@/foundation/models/context';

describe('parsePlanFromText', () => {
  it('parses numbered list', () => {
    const text = `Here is my plan:
1. Read the existing file
2. Write a new blog post
3. Review the output

Let me start.`;
    const items = parsePlanFromText(text);
    expect(items).toHaveLength(3);
    expect(items[0].task).toBe('Read the existing file');
    expect(items[1].task).toBe('Write a new blog post');
    expect(items[2].task).toBe('Review the output');
    expect(items.every(i => i.status === 'pending')).toBe(true);
  });

  it('parses Chinese numbered list', () => {
    const text = `计划如下：
1. 读取现有博客
2. 撰写新文章
3. 保存文件`;
    const items = parsePlanFromText(text);
    expect(items).toHaveLength(3);
    expect(items[0].task).toBe('读取现有博客');
  });

  it('parses dash list', () => {
    const text = `Plan:
- Read file
- Edit content
- Save changes`;
    const items = parsePlanFromText(text);
    expect(items).toHaveLength(3);
  });

  it('returns empty for text without list', () => {
    const text = 'I will help you with that. Let me read the file.';
    const items = parsePlanFromText(text);
    expect(items).toHaveLength(0);
  });

  it('ignores very short items', () => {
    const text = '1. Hi\n2. OK\n3. Read the documentation and understand it';
    const items = parsePlanFromText(text);
    // "Hi" (2 chars) and "OK" (2 chars) are below threshold of 3
    expect(items).toHaveLength(1);
  });
});

describe('PlannerMiddleware', () => {
  it('injects planning prompt on step 1 beforeModel', async () => {
    const mw = new PlannerMiddleware({ onPlanUpdate: vi.fn() });
    await mw.beforeAgentStep!(1);

    const context: ModelContext = {
      prompt: 'You are a coding assistant.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Write a blog' }] }],
    };
    const patch = await mw.beforeModel!(context);

    // Should modify the prompt to include planning instruction
    expect(patch?.prompt).toContain('plan');
  });

  it('does NOT inject planning prompt on step > 1', async () => {
    const mw = new PlannerMiddleware({ onPlanUpdate: vi.fn() });
    await mw.beforeAgentStep!(2);

    const context: ModelContext = {
      prompt: 'You are a coding assistant.',
      messages: [],
    };
    const patch = await mw.beforeModel!(context);
    expect(patch).toBeUndefined();
  });

  it('parses plan from afterModel response on step 1', async () => {
    const onPlanUpdate = vi.fn();
    const mw = new PlannerMiddleware({ onPlanUpdate });
    await mw.beforeAgentStep!(1);

    const msg = {
      role: 'assistant' as const,
      content: [{
        type: 'text' as const,
        text: 'Plan:\n1. Read existing files\n2. Write blog post\n3. Save file',
      }],
    };
    await mw.afterModel!(msg);

    expect(onPlanUpdate).toHaveBeenCalled();
    const plan = onPlanUpdate.mock.calls[0][0] as PlanItem[];
    expect(plan).toHaveLength(3);
    expect(plan[0].status).toBe('pending');
  });

  it('marks plan items as done after tool use', async () => {
    const onPlanUpdate = vi.fn();
    const mw = new PlannerMiddleware({ onPlanUpdate });
    await mw.beforeAgentStep!(1);

    // Set up plan
    await mw.afterModel!({
      role: 'assistant',
      content: [{ type: 'text', text: '1. Read the file\n2. Write new content\n3. Save it' }],
    });
    onPlanUpdate.mockClear();

    // Simulate tool use completion
    await mw.afterToolUse!(
      { type: 'tool_use', id: '1', name: 'read_file', input: {} },
      'file content here',
    );

    expect(onPlanUpdate).toHaveBeenCalled();
    const updated = onPlanUpdate.mock.calls[0][0] as PlanItem[];
    expect(updated[0].status).toBe('done'); // "Read the file" matches read_file
  });

  it('marks all remaining as done after agent run', async () => {
    const onPlanUpdate = vi.fn();
    const mw = new PlannerMiddleware({ onPlanUpdate });
    await mw.beforeAgentStep!(1);

    await mw.afterModel!({
      role: 'assistant',
      content: [{ type: 'text', text: '1. Analyze request\n2. Generate code' }],
    });
    onPlanUpdate.mockClear();

    await mw.afterAgentRun!();

    const updated = onPlanUpdate.mock.calls[0][0] as PlanItem[];
    expect(updated.every(i => i.status === 'done')).toBe(true);
  });
});
