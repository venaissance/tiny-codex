import { defineTool } from '../../foundation/tools';
import { z } from 'zod';

export interface AskUserQuestion {
  question: string;
  options?: Array<{ label: string; value: string }>;
}

export type AskUserHandler = (q: AskUserQuestion) => Promise<string>;

let askUserHandler: AskUserHandler = async ({ question }) => {
  return `[No UI available] Question was: ${question}`;
};

export function setAskUserHandler(handler: AskUserHandler): void {
  askUserHandler = handler;
}

export const askUserTool = defineTool({
  name: 'ask_user',
  description: 'Ask the user a question and wait for their response. Optionally provide selectable options.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user (supports markdown)'),
    options: z.array(z.object({
      label: z.string().describe('Display text for this option'),
      value: z.string().describe('Value returned when user selects this option'),
    })).optional().describe('Clickable options for the user to choose from'),
  }),
  invoke: async ({ question, options }) => {
    return askUserHandler({ question, options });
  },
});
