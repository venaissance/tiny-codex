import { defineTool } from '../../foundation/tools';
import { z } from 'zod';

export type AskUserHandler = (question: string) => Promise<string>;

let askUserHandler: AskUserHandler = async (question) => {
  return `[No UI available] Question was: ${question}`;
};

export function setAskUserHandler(handler: AskUserHandler): void {
  askUserHandler = handler;
}

export const askUserTool = defineTool({
  name: 'ask_user',
  description: 'Ask the user a question and wait for their response.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  invoke: async ({ question }) => {
    return askUserHandler(question);
  },
});
