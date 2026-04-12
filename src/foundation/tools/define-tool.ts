import { type z } from 'zod';

export interface FunctionTool<P extends z.ZodSchema = z.ZodSchema, R = string> {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>) => Promise<R>;
  toJSONSchema: () => Record<string, unknown>;
}

export function defineTool<P extends z.ZodSchema, R = string>(config: {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>) => Promise<R>;
}): FunctionTool<P, R> {
  return {
    ...config,
    toJSONSchema() {
      if ('toJSONSchema' in config.parameters) {
        return (config.parameters as any).toJSONSchema();
      }
      throw new Error('Zod schema does not support toJSONSchema(). Use Zod v4+.');
    },
  };
}
