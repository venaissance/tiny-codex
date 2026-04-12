import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { readFileTool, writeFileTool, strReplaceTool, listDirTool } from '@/coding/tools';
import { createUserMessage } from '@/foundation/messages';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('Agent + File Tools Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-integration-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('agent creates a file, reads it, then modifies it', async () => {
    const filePath = join(tmpDir, 'test.ts');

    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c1', name: 'write_file',
          input: { path: filePath, content: 'const x = 1;\n' },
        }],
      },
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c2', name: 'read_file',
          input: { path: filePath },
        }],
      },
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c3', name: 'str_replace',
          input: { path: filePath, old_string: 'const x = 1;', new_string: 'const x = 42;' },
        }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Done! x is now 42.' }],
      },
    ]);

    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [readFileTool, writeFileTool, strReplaceTool, listDirTool],
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('create and modify a file'))) {
      messages.push(msg);
    }

    const finalContent = await readFile(filePath, 'utf-8');
    expect(finalContent).toBe('const x = 42;\n');
    expect(messages).toHaveLength(7);
  });
});
