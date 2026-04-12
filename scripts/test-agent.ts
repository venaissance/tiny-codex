/**
 * 快速测试 Agent 框架是否能连通真实 API
 *
 * 使用方式：npx tsx scripts/test-agent.ts
 */
import { Model } from '../src/foundation/models/model';
import { OpenAIModelProvider } from '../src/community/openai/provider';
import { createCodingAgent } from '../src/coding/agents/create-agent';
import { createUserMessage } from '../src/foundation/messages';

async function main() {
  // MiniMax API (OpenAI 兼容)
  const minimaxProvider = new OpenAIModelProvider({
    baseURL: 'https://api.minimax.chat/v1',
    apiKey: process.env.MINIMAX_API_KEY!,
  });

  // GLM API (OpenAI 兼容)
  const glmProvider = new OpenAIModelProvider({
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: process.env.GLM_API_KEY!,
  });

  // 选择一个 provider 测试
  const provider = minimaxProvider;
  const modelName = 'MiniMax-Text-01'; // MiniMax 模型 ID

  console.log(`\n🚀 Testing tiny-codex Agent with ${modelName}...\n`);

  const model = new Model(modelName, provider, {
    max_tokens: 2048,
  });

  const agent = await createCodingAgent({
    model,
    cwd: process.cwd(),
    maxSteps: 5,
  });

  console.log('📤 Sending: "列出当前目录下的文件"\n');

  try {
    for await (const msg of agent.stream(createUserMessage('列出当前目录下的文件，简要说明每个文件的作用'))) {
      if (msg.role === 'assistant') {
        for (const c of msg.content) {
          if (c.type === 'thinking') {
            console.log(`💭 Thinking: ${c.thinking.slice(0, 100)}...`);
          } else if (c.type === 'text') {
            console.log(`🤖 Agent: ${c.text}`);
          } else if (c.type === 'tool_use') {
            console.log(`🔧 Tool: ${c.name}(${JSON.stringify(c.input).slice(0, 80)})`);
          }
        }
      } else if (msg.role === 'tool') {
        for (const c of msg.content) {
          const preview = c.content.slice(0, 200);
          console.log(`📋 Result: ${preview}${c.content.length > 200 ? '...' : ''}`);
        }
      }
      console.log('');
    }
    console.log('✅ Agent completed successfully!');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

main();
