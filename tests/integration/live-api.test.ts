/**
 * Live API 测试 — 需要真实 API Key 才能跑
 *
 * 运行方式（需要显式开启）：
 *   RUN_LIVE_TESTS=1 npx vitest run tests/integration/live-api.test.ts
 *
 * 默认跳过。设置 RUN_LIVE_TESTS=1 + 对应 API Key 环境变量才会执行。
 *
 * 所有 Provider 统一使用 OpenAI 兼容模式：
 *   MiniMax: https://api.minimaxi.com/v1 + reasoning_split=true
 *   GLM: https://open.bigmodel.cn/api/paas/v4
 */
import { describe, it, expect } from 'vitest';
import { Model } from '@/foundation/models/model';
import { OpenAIModelProvider } from '@/community/openai/provider';
import type { ModelProvider } from '@/foundation/models/provider';
import { Agent } from '@/agent/agent';
import { defineTool } from '@/foundation/tools';
import { createUserMessage } from '@/foundation/messages';
import { z } from 'zod';

const MINIMAX_KEY = process.env.MINIMAX_API_KEY;
const GLM_KEY = process.env.GLM_API_KEY;
const ARK_KEY = process.env.ARK_API_KEY;

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1';
const hasAnyKey = MINIMAX_KEY || GLM_KEY || ARK_KEY;

describe.skipIf(!RUN_LIVE || !hasAnyKey)('Live API Integration', () => {
  function getProvider(): { provider: ModelProvider; modelName: string; mode: string } {
    if (MINIMAX_KEY) {
      return {
        provider: new OpenAIModelProvider({
          baseURL: process.env.MINIMAX_OPENAI_BASE_URL || 'https://api.minimaxi.com/v1',
          apiKey: MINIMAX_KEY,
          defaultOptions: { reasoning_split: true },
        }),
        modelName: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
        mode: 'openai-compat',
      };
    }
    if (GLM_KEY) {
      return {
        provider: new OpenAIModelProvider({
          baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
          apiKey: GLM_KEY,
        }),
        modelName: process.env.GLM_MODEL || 'glm-5.1',
        mode: 'openai-compat',
      };
    }
    if (ARK_KEY) {
      return {
        provider: new OpenAIModelProvider({
          baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
          apiKey: ARK_KEY,
        }),
        modelName: process.env.ARK_MODEL || 'ep-20260311141959-w8cpr',
        mode: 'openai-compat',
      };
    }
    throw new Error('No API key found');
  }

  it('simple text response — no tools', async () => {
    const { provider, modelName, mode } = getProvider();
    const model = new Model(modelName, provider, { max_tokens: 256 });

    console.log(`  [${modelName}] mode=${mode}`);

    const result = await model.invoke({
      prompt: 'You are a helpful assistant. Reply in one short sentence.',
      messages: [createUserMessage('What is 2+2?')],
    });

    expect(result.role).toBe('assistant');
    expect(result.content.length).toBeGreaterThan(0);

    for (const c of result.content) {
      if (c.type === 'thinking') console.log(`  [${modelName}] Thinking: ${c.thinking.slice(0, 100)}...`);
      if (c.type === 'text') console.log(`  [${modelName}] Response: ${c.text}`);
    }
  }, 30000);

  it('agent with echo tool — model calls tool', async () => {
    const { provider, modelName } = getProvider();
    const model = new Model(modelName, provider, { max_tokens: 512 });

    const echoTool = defineTool({
      name: 'echo',
      description: 'Echoes back the message. Use this tool when asked to echo something.',
      parameters: z.object({
        message: z.string().describe('The message to echo'),
      }),
      invoke: async ({ message }) => `Echo: ${message}`,
    });

    const agent = new Agent({
      model,
      prompt: 'You are a helpful assistant. When asked to echo something, you MUST use the echo tool.',
      tools: [echoTool],
      maxSteps: 3,
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('Please echo "hello tiny-codex"'))) {
      messages.push(msg);
      if (msg.role === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'text') console.log(`  [${modelName}] Text: ${c.text}`);
          if (c.type === 'thinking') console.log(`  [${modelName}] Think: ${c.thinking.slice(0, 80)}...`);
          if (c.type === 'tool_use') console.log(`  [${modelName}] Tool: ${c.name}(${JSON.stringify(c.input)})`);
        }
      }
      if (msg.role === 'tool') {
        console.log(`  [${modelName}] Result: ${msg.content[0].content}`);
      }
    }

    expect(messages.length).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('agent with file tools — read a real file', async () => {
    const { provider, modelName } = getProvider();
    const model = new Model(modelName, provider, { max_tokens: 1024 });

    const readFileTool = defineTool({
      name: 'read_file',
      description: 'Read a file and return its contents.',
      parameters: z.object({
        path: z.string().describe('Absolute path to the file'),
      }),
      invoke: async ({ path }) => {
        const fs = await import('fs/promises');
        try {
          return await fs.readFile(path, 'utf-8');
        } catch (err: any) {
          return `Error: ${err.message}`;
        }
      },
    });

    const agent = new Agent({
      model,
      prompt: 'You are a coding assistant. Use the read_file tool to read files when asked.',
      tools: [readFileTool],
      maxSteps: 3,
    });

    const packageJsonPath = require('path').resolve(__dirname, '../../package.json');
    const messages = [];
    for await (const msg of agent.stream(createUserMessage(`Read the file at ${packageJsonPath} and tell me the project name`))) {
      messages.push(msg);
      if (msg.role === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'text') console.log(`  [${modelName}] Text: ${c.text}`);
          if (c.type === 'tool_use') console.log(`  [${modelName}] Tool: ${c.name}(${JSON.stringify(c.input).slice(0, 80)})`);
        }
      }
      if (msg.role === 'tool') {
        console.log(`  [${modelName}] ToolResult: ${msg.content[0].content.slice(0, 100)}...`);
      }
    }

    expect(messages.length).toBeGreaterThanOrEqual(1);
  }, 60000);
});
