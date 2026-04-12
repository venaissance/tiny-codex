/**
 * MockModelProvider for E2E testing.
 * Returns scripted responses without calling any external API.
 * Supports streaming simulation via onStream callback.
 * Enabled via E2E_MOCK=1 environment variable.
 */
import type { ModelProvider } from '../../foundation/models/provider';
import type { AssistantMessage, Message } from '../../foundation/messages/types';
import type { FunctionTool } from '../../foundation/tools/define-tool';
import type { StreamCallback } from '../stream-types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export class MockModelProvider implements ModelProvider {
  public onStream?: StreamCallback;
  public supportsStreaming = true;

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
      const response = this.buildToolCall(userText, params.tools);
      await this.simulateStreaming(response);
      return response;
    }

    // Return text response
    const response: AssistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: `[Mock] Response to: "${userText.slice(0, 80)}"` }],
    };
    await this.simulateStreaming(response);
    return response;
  }

  /**
   * Simulate streaming by emitting delta events before returning the complete message.
   * This mirrors real provider behavior: deltas flow via onStream, then invoke() returns.
   */
  private async simulateStreaming(response: AssistantMessage): Promise<void> {
    if (!this.onStream) return;

    for (const block of response.content) {
      if (block.type === 'text') {
        // Emit text in small chunks (5 chars at a time, 5ms apart)
        const text = block.text;
        for (let i = 0; i < text.length; i += 5) {
          this.onStream({ type: 'text_delta', text: text.slice(i, i + 5) });
          await delay(5);
        }
      }

      if (block.type === 'tool_use') {
        // Emit tool_use_start then argument chunks
        this.onStream({ type: 'tool_use_start', id: block.id, name: block.name });
        const json = JSON.stringify(block.input);
        for (let i = 0; i < json.length; i += 20) {
          this.onStream({ type: 'tool_use_delta', partialJson: json.slice(i, i + 20) });
          await delay(5);
        }
        this.onStream({ type: 'content_block_stop' });
      }
    }
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

    if (lower.includes('read') && !lower.includes('write')) {
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
        // Extract path: "Write file /path/to/file" or "Create /path/to/file"
        const pathMatch = text.match(/(?:write\s+file|create)\s+(\S+)/i);
        return {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: `mock-${Date.now()}`,
            name: 'write_file',
            input: {
              path: pathMatch?.[1] ?? '/tmp/mock-test.txt',
              content: '# Mock File\n\nThis is mock content written by the test agent.',
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
