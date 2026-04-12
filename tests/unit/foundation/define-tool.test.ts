import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool } from '@/foundation/tools/define-tool';

describe('defineTool', () => {
  it('creates a tool with name, description, parameters, invoke', () => {
    const tool = defineTool({
      name: 'echo',
      description: 'Echoes input',
      parameters: z.object({
        message: z.string().describe('The message to echo'),
      }),
      invoke: async ({ message }) => message,
    });

    expect(tool.name).toBe('echo');
    expect(tool.description).toBe('Echoes input');
    expect(tool.parameters).toBeDefined();
  });

  it('invoke executes the function', async () => {
    const tool = defineTool({
      name: 'add',
      description: 'Adds two numbers',
      parameters: z.object({
        a: z.number(),
        b: z.number(),
      }),
      invoke: async ({ a, b }) => String(a + b),
    });

    const result = await tool.invoke({ a: 2, b: 3 });
    expect(result).toBe('5');
  });

  it('generates JSON Schema from Zod schema', () => {
    const tool = defineTool({
      name: 'test',
      description: 'test',
      parameters: z.object({
        path: z.string().describe('File path'),
        verbose: z.boolean().optional(),
      }),
      invoke: async () => '',
    });

    const schema = tool.toJSONSchema();
    expect(schema.type).toBe('object');
    expect((schema as any).properties.path).toBeDefined();
  });
});
