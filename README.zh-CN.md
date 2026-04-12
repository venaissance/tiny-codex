# TinyCodex

[English](README.md) | [中文](#)

轻量级 Electron AI 编程助手。打开本地项目，让 LLM Agent 帮你读写和执行代码——支持实时流式预览。

## 功能特性

- **Agent 驱动编辑** — ReAct 循环 + 8 个内置工具（bash、读写文件、str_replace、glob、grep、list_dir、ask_user）
- **多模型支持** — OpenAI 兼容协议（MiniMax、GLM、豆包/ARK、OpenAI），按 provider 控制流式开关
- **实时流式输出** — 逐 token 渲染（rAF 批量合并），写文件时右侧面板实时预览内容
- **思考过程可视化** — 可展开的 reasoning 卡片，实时显示 LLM 推理过程
- **富预览面板** — Monaco 代码编辑器、Streamdown Markdown、Diff 视图、图片/PDF/CSV/JSON/HTML 预览
- **进度追踪** — 侧边栏实时显示 Agent 步骤（thinking → tool call → reflecting → done）
- **Skills 扩展** — 通过 Markdown 文件定义自定义工具，扩展 Agent 能力
- **Git Worktree** — 隔离分支执行模式
- **轨迹记录** — 完整 Agent 步骤历史，方便调试

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制并配置 API Key
cp .env.example .env

# 启动开发模式
pnpm run dev
```

### 支持的模型提供商

| 提供商 | 环境变量 | 流式输出 | 备注 |
|--------|---------|---------|------|
| MiniMax | `MINIMAX_API_KEY` | 支持 | 自动启用 `reasoning_split=true` |
| GLM (智谱) | `GLM_API_KEY` | 不支持 | 非流式回退 |
| 豆包/ARK | `ARK_API_KEY` | 支持 | 字节跳动火山引擎 |
| OpenAI | `OPENAI_API_KEY` | 支持 | 原生 OpenAI |

## 架构

```
Renderer (React)  ──IPC──  Main Process (Electron)
     │                          │
     ├── Zustand stores         ├── ThreadManager
     ├── useAgent hook          │   └── Agent.stream()
     ├── Streamdown/Monaco      │       ├── think() → Model.invoke()
     └── file-writing events    │       └── act()  → Tool.invoke()
                                └── SQLite (线程/消息持久化)
```

**四层架构，严格自上而下依赖：**

| 层 | 职责 |
|----|------|
| Foundation | Model/Provider 接口、消息类型、`defineTool()` |
| Agent | ReAct 循环、中间件链（8 个 hook）、上下文压缩 |
| Coding | 8 个工具实现、`createCodingAgent()` 工厂 |
| App | Electron 窗口、IPC 处理、React UI、预览面板 |

### 流式渲染管线

```
Provider SSE → onStream 回调 → IPC (AGENT_STREAM_DELTA) → useAgent hook
  text_delta      → rAF 批量合并 → appendStreamingText → 聊天区自动滚动
  thinking_delta  → appendStreamingThinking → 可展开的思考卡片
  tool_use_start  → setAgentState('tool_calling') → 状态指示器更新
  tool_use_delta  → 从 JSON 提取 content → file-writing 事件 → 实时预览
```

## 项目结构

```
src/
├── foundation/     # Model/Provider 抽象、消息类型、工具框架
├── agent/          # ReAct 循环、中间件、压缩、轨迹记录
├── coding/         # 8 个标准工具、Agent 工厂、Worktree 管理
├── community/      # OpenAI + Mock Provider、共享流式类型
├── main/           # Electron 主进程、IPC、SQLite、窗口
├── renderer/       # React UI、Zustand 状态管理、Streamdown 渲染
└── shared/         # IPC 通道常量
```

## 测试

```bash
# 单元 + 集成 + 组件测试（220 个）
pnpm test

# Mock LLM 的 E2E 测试（~10 秒，无需 API Key）
npx playwright test tests/e2e/smoke.test.ts

# 流式预览 E2E（验证无闪烁）
npx playwright test tests/e2e/scenarios/streaming-preview.test.ts

# 真实 API 测试（需要 .env 配置）
RUN_LIVE_TESTS=1 pnpm test -- tests/integration/live-api.test.ts
```

### 测试覆盖

| 类别 | 数量 | 范围 |
|------|------|------|
| 单元测试 | 120+ | Agent 循环、工具、Provider、Store、流式逻辑 |
| 组件测试 | 55+ | MessageHistory、AgentProcess、Sidebar、Preview、InputBox |
| 集成测试 | 14 | ThreadManager、Agent-Tools、Skills、真实 API |
| E2E | 5 个场景 | Smoke、流式预览、完整工作流 |

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 41, Node.js |
| UI | React 19, Zustand 5, Streamdown 2, Monaco Editor |
| 样式 | Tailwind CSS v4, Shiki（语法高亮） |
| 构建 | Vite, TypeScript |
| 测试 | Vitest, Playwright, Testing Library |
| 数据库 | SQLite (sql.js) |

## 构建与打包

```bash
# 生产构建
pnpm run build

# macOS 打包（目录模式）
pnpm run pack

# 完整发布构建
pnpm run release
```

## 许可证

[MIT](LICENSE)
