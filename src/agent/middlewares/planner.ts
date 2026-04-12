import type { AgentMiddleware } from '../middleware';
import type { ModelContext } from '../../foundation/models/context';
import type { AssistantMessage, ToolUseContent } from '../../foundation/messages/types';

export interface PlanItem {
  id: number;
  task: string;
  status: 'pending' | 'running' | 'done';
}

export interface PlannerOptions {
  onPlanUpdate: (items: PlanItem[]) => void;
}

const PLANNING_INSTRUCTION = `
Before starting, output a brief numbered plan (3-5 steps) of what you'll do.
Format each step as "N. description" on its own line. Then proceed with execution.`.trim();

// Tool name → keywords that indicate the tool matches a plan step
const TOOL_KEYWORDS: Record<string, string[]> = {
  read_file: ['read', 'check', 'look', 'examine', 'review', 'analyze', '读取', '查看', '检查', '分析'],
  write_file: ['write', 'create', 'save', 'generate', 'output', '写', '创建', '保存', '生成'],
  str_replace: ['edit', 'modify', 'update', 'change', 'replace', '编辑', '修改', '更新', '替换'],
  bash: ['run', 'execute', 'install', 'test', 'build', '运行', '执行', '测试', '构建'],
  list_dir: ['list', 'browse', 'explore', '列出', '浏览'],
  glob: ['search', 'find', 'locate', '搜索', '查找'],
  grep: ['search', 'find', 'grep', '搜索', '查找'],
};

/**
 * Parse numbered or dashed list items from text.
 * Matches: "1. task", "- task", "* task"
 */
export function parsePlanFromText(text: string): PlanItem[] {
  const lines = text.split('\n');
  const items: PlanItem[] = [];
  let id = 1;

  for (const line of lines) {
    const match = line.match(/^\s*(?:\d+[.)]\s*|[-*]\s+)(.+)/);
    if (match) {
      const task = match[1].trim();
      if (task.length >= 3) { // Skip trivially short items (3 for CJK, generous for English)
        items.push({ id: id++, task, status: 'pending' });
      }
    }
  }

  return items;
}

export class PlannerMiddleware implements AgentMiddleware {
  private plan: PlanItem[] = [];
  private isFirstStep = false;
  private onPlanUpdate: (items: PlanItem[]) => void;

  constructor(options: PlannerOptions) {
    this.onPlanUpdate = options.onPlanUpdate;
  }

  async beforeAgentStep(step: number): Promise<void> {
    this.isFirstStep = step === 1;
  }

  async beforeModel(context: ModelContext): Promise<Partial<ModelContext> | void> {
    if (!this.isFirstStep || this.plan.length > 0) return;
    // Inject planning instruction into the system prompt
    return {
      prompt: context.prompt + '\n\n' + PLANNING_INSTRUCTION,
    };
  }

  async afterModel(message: AssistantMessage): Promise<AssistantMessage | void> {
    if (!this.isFirstStep || this.plan.length > 0) return;

    // Try to extract plan from the response text
    for (const block of message.content) {
      if (block.type === 'text') {
        const items = parsePlanFromText(block.text);
        if (items.length >= 2) {
          this.plan = items;
          this.emitPlan();
          break;
        }
      }
    }
  }

  async afterToolUse(toolUse: ToolUseContent, _result: string): Promise<void> {
    if (this.plan.length === 0) return;

    // Find the first pending plan item that matches the tool
    const keywords = TOOL_KEYWORDS[toolUse.name] ?? [];
    let matched = false;

    for (const item of this.plan) {
      if (item.status !== 'pending') continue;
      const lower = item.task.toLowerCase();
      if (keywords.some(kw => lower.includes(kw))) {
        item.status = 'done';
        matched = true;
        break;
      }
    }

    // If no keyword match, mark the first pending item as done (sequential progress)
    if (!matched) {
      const first = this.plan.find(i => i.status === 'pending');
      if (first) first.status = 'done';
    }

    this.emitPlan();
  }

  async afterAgentRun(): Promise<void> {
    // Mark all remaining items as done
    for (const item of this.plan) {
      item.status = 'done';
    }
    if (this.plan.length > 0) this.emitPlan();
  }

  private emitPlan(): void {
    this.onPlanUpdate(this.plan.map(i => ({ ...i })));
  }
}
