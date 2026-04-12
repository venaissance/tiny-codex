# Agent 框架分层设计

参考 helixent 三层架构，适配 tiny-codex 多场景需求。

## 分层架构总览

```
依赖方向（严格单向，从上到下）

┌─────────────────────────────────────────────────────────────┐
│                   App Layer (Electron)                       │
│        Renderer (React UI) ←IPC→ Main Process               │
│        线程管理 / 模型选择 / Monaco 编辑器 / 预览面板        │
└────────────────────────┬────────────────────────────────────┘
                         │ 使用
┌────────────────────────▼────────────────────────────────────┐
│                  Coding Layer (领域层)                       │
│     createCodingAgent() — 组装 Agent + 工具 + 中间件         │
│     8 个标准工具 + Skills 自定义工具 / Worktree 管理器       │
└────────────────────────┬────────────────────────────────────┘
                         │ 使用
┌────────────────────────▼────────────────────────────────────┐
│                  Agent Layer (核心层)                        │
│     Agent 类 — ReAct Loop (think → act → observe)           │
│     中间件系统（8 个生命周期钩子）                            │
│     Compaction 引擎（上下文压缩）                            │
└────────────────────────┬────────────────────────────────────┘
                         │ 使用
┌────────────────────────▼────────────────────────────────────┐
│                Foundation Layer (基础层)                     │
│     Model 抽象 / Message 类型 / FunctionTool / Provider 接口 │
└────────────────────────────────────────────────────────────┘
                         ↑ 实现
┌────────────────────────────────────────────────────────────┐
│              Community Layer (适配器层)                      │
│     OpenAIProvider (豆包/DeepSeek/Qwen/vLLM)               │
│     AnthropicProvider (Claude 原生 API)                     │
└────────────────────────────────────────────────────────────┘
```

## 与 helixent 的对比变化

| 模块 | helixent | tiny-codex | 变化原因 |
|------|---------|-----------|---------|
| 运行时 | Bun | **Node.js** | Electron 原生支持 |
| UI | Ink (终端 React) | **React DOM** | 桌面 GUI 需要 |
| Provider | 仅 OpenAI 兼容 | **+ Anthropic 原生** | Claude extended thinking |
| 工具数 | 4 个 | **8 个标准 + Skills 可注册自定义工具** | 补齐搜索和交互能力，支持扩展（如 image_gen） |
| 上下文管理 | 纯内存 | **SQLite + Compaction** | 多线程持久化需要 |
| 代码编辑器 | 无（CLI 终端） | **Monaco Editor** | IDE 级代码编辑 / 语法高亮 / Diff 视图 |
| 文件 API | Bun.file() | **fs/promises** | Node.js 标准库 |
| 进程执行 | Bun.spawn() | **child_process.spawn()** | Node.js 标准库 |

## 各层职责与关键接口

### Foundation Layer — 不依赖任何上层

```
src/foundation/
├── messages/
│   └── types.ts          # 统一消息类型
│       • TextContent       — 文本
│       • ImageContent      — 图片 URL
│       • ThinkingContent   — 推理过程（Anthropic extended thinking）
│       • ToolUseContent    — 工具调用请求
│       • ToolResultContent — 工具执行结果
│       SystemMessage / UserMessage / AssistantMessage / ToolMessage
│
├── models/
│   ├── model.ts           # Model 类 — 统一调用入口
│   ├── provider.ts        # ModelProvider 接口
│   └── context.ts         # ModelContext (prompt + messages + tools)
│
└── tools/
    └── define-tool.ts     # defineTool() 工厂 — Zod schema → JSON Schema
                           # 保持 helixent 的设计，类型安全
```

### Agent Layer — 依赖 Foundation

```
src/agent/
├── agent.ts               # Agent 类 — ReAct Loop 核心
│   • stream() → AsyncGenerator<AssistantMessage | ToolMessage>
│   • think()  → 调用 Model，获取响应
│   • act()    → 并行执行工具（保持 helixent 的 Promise.race 模式）
│   • abort()  → 中止当前执行
│
├── middleware.ts           # 8 个生命周期钩子（同 helixent）
│   beforeAgentRun / afterAgentRun
│   beforeAgentStep / afterAgentStep
│   beforeModel / afterModel
│   beforeToolUse / afterToolUse
│
├── compaction/
│   ├── compactor.ts       # 上下文压缩引擎
│   │   • shouldCompact()  → 判断是否超阈值
│   │   • compact()        → 用 LLM 生成摘要，替换旧消息
│   └── strategies.ts      # 压缩策略（full / micro）
│
└── skills/
    ├── skill-reader.ts    # SKILL.md frontmatter 解析（同 helixent）
    ├── skills-middleware.ts # 技能发现 + prompt 注入
    └── skill-tools.ts     # Skills 自定义工具注册
                           # Skills 可通过 defineTool() 注册额外工具
                           # 如 image_gen Skill 注册 generate_image 工具
                           # Agent 运行时动态加载已激活 Skill 的工具
```

### Coding Layer — 依赖 Agent

```
src/coding/
├── agents/
│   └── create-agent.ts    # createCodingAgent() 工厂
│       组装 Model + 8 标准工具 + Skill 自定义工具
│       + Skills 中间件 + Compaction 中间件
│       加载项目根目录的 AGENTS.md 作为初始上下文
│
├── tools/                 # 8 个标准工具
│   ├── bash.ts            # 执行 shell 命令 (child_process.spawn)
│   ├── read-file.ts       # 读取文件 (fs.readFile)
│   ├── write-file.ts      # 写入文件 (fs.writeFile)
│   ├── str-replace.ts     # 字符串替换
│   ├── glob.ts            # 文件模式搜索 (fast-glob)
│   ├── grep.ts            # 内容搜索 (ripgrep 子进程)
│   ├── list-dir.ts        # 目录浏览 (fs.readdir)
│   └── ask-user.ts        # 向用户提问 (通过 IPC 弹出对话框)
│
└── worktree/
    └── manager.ts         # Git Worktree 管理
        create() → git worktree add
        remove() → git worktree remove
        list()   → git worktree list
        merge()  → 合并回主分支
```

### Community Layer — 实现 Foundation 的 Provider 接口

```
src/community/
├── openai/
│   ├── provider.ts        # OpenAIModelProvider
│   │   使用 openai SDK
│   │   兼容：豆包 / DeepSeek / Qwen / vLLM / OpenAI
│   └── converter.ts       # 消息格式转换
│       toOpenAI()   → 内部消息 → OpenAI 格式
│       fromOpenAI() → OpenAI 响应 → 内部消息
│       reasoning_content → ThinkingContent（豆包/DeepSeek）
│
└── anthropic/
    ├── provider.ts        # AnthropicModelProvider
    │   使用 @anthropic-ai/sdk
    │   原生支持 extended thinking / content blocks
    └── converter.ts       # 消息格式转换
        toAnthropic()   → 内部消息 → Anthropic 格式
        fromAnthropic() → Anthropic 响应 → 内部消息
        天然对齐（内部格式参考 Anthropic 设计）
```

## 数据流：一次完整的 Agent 交互

```
用户在 Chat Panel 输入 "帮我给 Button 组件加一个 loading 状态"
  │
  ▼ IPC
Main Process: ThreadManager 找到当前线程的 Agent 实例
  │
  ▼ agent.stream(userMessage)
Agent Loop Step 1:
  │ think() → Model.invoke() → OpenAIProvider / AnthropicProvider
  │ ← AssistantMessage: [thinking: "需要先看看 Button 组件..."]
  │                      [tool_use: read_file({path: "src/Button.tsx"})]
  │
  │ act() → readFileTool.invoke() → fs.readFile()
  │ ← ToolMessage: [tool_result: "文件内容..."]
  │
  │ yield AssistantMessage → IPC → Renderer 渲染思考过程
  │ yield ToolMessage      → IPC → Renderer 渲染文件内容
  │
Agent Loop Step 2:
  │ think() → Model.invoke()
  │ ← AssistantMessage: [text: "我来添加 loading 状态"]
  │                      [tool_use: str_replace({...})]
  │
  │ act() → strReplaceTool.invoke()
  │ ← ToolMessage: [tool_result: "替换完成"]
  │
  │ yield → Renderer 渲染 + Preview Panel 自动刷新 (HMR)
  │
Agent Loop Step 3:
  │ think() → Model.invoke()
  │ ← AssistantMessage: [text: "已完成，Button 现在支持 loading prop"]
  │                      (无 tool_use → 循环结束)
  │
  ▼ afterAgentRun()
ThreadManager: 持久化消息到 SQLite → 检查是否需要 Compaction
```
