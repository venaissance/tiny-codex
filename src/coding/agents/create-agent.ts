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

export async function createCodingAgent(options: CodingAgentOptions): Promise<Agent> {
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

  const prompt = '<agent name="tiny-codex" role="coding_assistant">\nYou are a coding assistant. Use the provided tools to read, write, and modify files.\nWork in the project directory: ' + cwd + '\n</agent>';

  return new Agent({
    model: options.model,
    prompt,
    messages,
    tools: standardTools,
    middlewares: [
      createSkillsMiddleware(skillsDirs),
      ...(options.onPlanUpdate ? [new PlannerMiddleware({ onPlanUpdate: options.onPlanUpdate })] : []),
    ],
    maxSteps: options.maxSteps ?? 100,
    threadId: options.threadId,
    onStateChange: options.onStateChange,
  });
}
