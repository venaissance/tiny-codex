import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createSkillsMiddleware } from '@/agent/skills';
import { SkillToolRegistry } from '@/agent/skills/skill-tools';
import { defineTool } from '@/foundation/tools';
import { createUserMessage } from '@/foundation/messages';
import { z } from 'zod';
import path from 'path';

describe('Skills System Integration', () => {
  const skillsDir = path.resolve(__dirname, '../fixtures/sample-skills');

  it('skills middleware loads skills and injects into prompt', async () => {
    const provider = new MockModelProvider([{
      role: 'assistant',
      content: [{ type: 'text', text: 'I see the skills available.' }],
    }]);
    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'You are helpful.',
      middlewares: [createSkillsMiddleware([skillsDir])],
    });

    for await (const _ of agent.stream(createUserMessage('hi'))) {}

    const systemMsg = provider.invocations[0].messages[0] as any;
    expect(systemMsg.content[0].text).toContain('<skills>');
    expect(systemMsg.content[0].text).toContain('test-skill');
  });

  it('SkillToolRegistry registers and provides custom tools', () => {
    const registry = new SkillToolRegistry();
    const imageTool = defineTool({
      name: 'generate_image',
      description: 'Generate an image from a prompt',
      parameters: z.object({ prompt: z.string() }),
      invoke: async ({ prompt }) => `image_url_for: ${prompt}`,
    });

    registry.register(imageTool);
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('generate_image')).toBe(imageTool);

    registry.unregister('generate_image');
    expect(registry.getAll()).toHaveLength(0);
  });

  it('agent can use skill-registered custom tools', async () => {
    const imageTool = defineTool({
      name: 'generate_image',
      description: 'Generate an image',
      parameters: z.object({ prompt: z.string() }),
      invoke: async ({ prompt }) => `https://images.example.com/${encodeURIComponent(prompt)}.png`,
    });

    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c1', name: 'generate_image',
          input: { prompt: 'a cat coding' },
        }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Image generated!' }],
      },
    ]);
    const model = new Model('test', provider);
    const agent = new Agent({ model, prompt: 'test', tools: [imageTool] });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('generate a cat image'))) {
      messages.push(msg);
    }

    expect(messages).toHaveLength(3);
    expect(messages[1].content[0].content).toContain('images.example.com');
  });
});
