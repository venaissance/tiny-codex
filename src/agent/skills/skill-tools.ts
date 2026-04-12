import type { FunctionTool } from '../../foundation/tools/define-tool';

export class SkillToolRegistry {
  private tools: Map<string, FunctionTool<any, any>> = new Map();

  register(tool: FunctionTool<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getAll(): FunctionTool<any, any>[] {
    return [...this.tools.values()];
  }

  get(name: string): FunctionTool<any, any> | undefined {
    return this.tools.get(name);
  }
}
