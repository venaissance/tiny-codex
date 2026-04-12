/**
 * MockModelProvider for E2E testing.
 * Returns scripted responses without calling any external API.
 * Enabled via E2E_MOCK=1 environment variable.
 */
import type { ModelProvider } from '../../foundation/models/provider';
import type { AssistantMessage, Message } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';

export class MockModelProvider implements ModelProvider {
  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    // Find the last user message
    const lastUser = [...params.messages].reverse().find(m => m.role === 'user');
    const userText = lastUser?.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('') ?? '';

    // Check if we already have a tool result in messages (means tool was used, now respond)
    const hasToolResult = params.messages.some(m => m.role === 'tool');

    // First call with tool-worthy prompt: use a tool
    if (!hasToolResult && params.tools?.length && this.shouldUseTool(userText)) {
      return this.buildToolCall(userText, params.tools);
    }

    // Return text response (no delay needed for mock)
    return {
      role: 'assistant',
      content: [{ type: 'text', text: `[Mock] Response to: "${userText.slice(0, 80)}"` }],
    };
  }

  private shouldUseTool(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('bash') || lower.includes('read') || lower.includes('write')
      || lower.includes('file') || lower.includes('run') || lower.includes('create')
      || lower.includes('echo');
  }

  private buildToolCall(text: string, tools: FunctionTool<any, any>[]): AssistantMessage {
    const lower = text.toLowerCase();

    if (lower.includes('bash') || lower.includes('run') || lower.includes('echo')) {
      const bashTool = tools.find(t => t.name === 'bash');
      if (bashTool) {
        // Extract command from quotes if possible
        const cmdMatch = text.match(/"([^"]+)"/);
        return {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: `mock-${Date.now()}`,
            name: 'bash',
            input: { command: cmdMatch?.[1] ?? 'echo hello-mock' },
          }],
        };
      }
    }

    if (lower.includes('read') || lower.includes('file')) {
      const readTool = tools.find(t => t.name === 'read_file');
      if (readTool) {
        const pathMatch = text.match(/(?:read|file)\s+(\S+)/i);
        return {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: `mock-${Date.now()}`,
            name: 'read_file',
            input: { path: pathMatch?.[1] ?? '/tmp/test.txt' },
          }],
        };
      }
    }

    if (lower.includes('write') || lower.includes('create')) {
      const writeTool = tools.find(t => t.name === 'write_file');
      if (writeTool) {
        const pathMatch = text.match(/(?:create|write)\s+(\S+)/i);
        return {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: `mock-${Date.now()}`,
            name: 'write_file',
            input: {
              path: pathMatch?.[1] ?? '/tmp/mock-test.txt',
              content: 'Mock file content',
            },
          }],
        };
      }
    }

    // Fallback: text response
    return {
      role: 'assistant',
      content: [{ type: 'text', text: `[Mock] I would use a tool for: "${text.slice(0, 80)}"` }],
    };
  }
}
