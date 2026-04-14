import { readFile } from 'fs/promises';
import { join } from 'path';
import { Agent } from '../../agent/agent';
import type { Model } from '../../foundation/models/model';
import type { AgentStateEvent } from '../../agent/trajectory';
import { createSkillsMiddleware } from '../../agent/skills';
import { PlannerMiddleware } from '../../agent/middlewares/planner';
import { standardTools } from '../tools';
import { createUserMessage } from '../../foundation/messages';
import type { NonSystemMessage } from '../../foundation/messages/types';

export interface CodingAgentOptions {
  model: Model;
  cwd?: string;
  skillsDirs?: string[];
  maxSteps?: number;
  threadId?: string;
  onStateChange?: (event: AgentStateEvent) => void;
  onPlanUpdate?: (items: any[]) => void;
  historyMessages?: NonSystemMessage[];
}

export async function createCodingAgent(options: CodingAgentOptions): Promise<{ agent: Agent; skillsController: ReturnType<typeof createSkillsMiddleware> }> {
  const cwd = options.cwd ?? process.cwd();
  const skillsDirs = options.skillsDirs ?? [join(cwd, 'skills')];
  const messages: NonSystemMessage[] = [];

  try {
    const agentsPath = join(cwd, 'AGENTS.md');
    const content = await readFile(agentsPath, 'utf-8');
    messages.push(createUserMessage('[AGENTS.md automatically loaded]\n' + content));
  } catch {
    // No AGENTS.md
  }

  // Restore conversation history from DB
  if (options.historyMessages?.length) {
    messages.push(...options.historyMessages);
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD Beijing time

  const prompt = `<agent name="tiny-codex" role="coding_assistant">
You are a coding assistant. Use the provided tools to read, write, and modify files.
Work in the project directory: ${cwd}
Today's date: ${today}

IMPORTANT: At the end of EVERY response, generate 2-3 short follow-up actions the user might want next. Output them as an HTML comment in this exact format:
<!-- suggestions: ["action 1", "action 2", "action 3"] -->
The suggestions must be context-aware, specific, and actionable (not generic). Examples:
- After writing a file: ["Add unit tests", "Optimize performance", "Write documentation"]
- After explaining code: ["Refactor this function", "Show usage examples", "Find similar patterns"]
- After fixing a bug: ["Run tests to verify", "Check for similar issues", "Add regression test"]
</agent>`;

  const skillsController = createSkillsMiddleware(skillsDirs);

  const agent = new Agent({
    model: options.model,
    prompt,
    messages,
    tools: standardTools,
    middlewares: [
      skillsController.middleware,
      ...(options.onPlanUpdate ? [new PlannerMiddleware({ onPlanUpdate: options.onPlanUpdate })] : []),
    ],
    maxSteps: options.maxSteps ?? 100,
    threadId: options.threadId,
    onStateChange: options.onStateChange,
  });

  return { agent, skillsController };
}
