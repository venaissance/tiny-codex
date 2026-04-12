# tiny-codex 设计规格书

> 轻量 Agent IDE — 代码开发 / 技术写作 / 文件预览 / 图片生成

## 1. 项目概述

tiny-codex 是一个基于 Electron 的轻量级 Agent IDE 桌面应用，类似 OpenAI Codex Mac App。用户可以打开本地项目，通过对话式交互让 Agent 编辑代码、撰写文章、生成图片等。Agent 框架参考 helixent 的三层 ReAct 架构，从零搭建。

### 目标场景

| 场景 | Agent 做什么 | 预览需求 |
|------|------------|---------|
| 前端开发 | 读写 React 代码、跑 dev server | 实时预览运行中的页面 |
| 技术写作 | 生成/编辑 Markdown 文章 | Markdown 渲染预览（支持本地图片） |
| 数据/文档 | 处理 CSV/JSON/HTML 文件 | 结构化预览 |
| 图片生成 | 通过 Skill 调用图片生成 API | 图片预览（单张/画廊） |
| 文档阅读 | 打开和浏览 PDF 文件 | PDF 渲染预览 |

## 2. 技术决策汇总

| 维度 | 决策 | 详细设计 |
|------|------|---------|
| 项目名 | **tiny-codex** | — |
| 技术栈 | Node.js + React + Electron | — |
| 模型后端 | OpenAI 兼容（MiniMax / GLM / ARK / OpenAI） | [04-agent-framework](04-design-agent-framework.md) |
| 执行模式 | Local + Worktree | — |
| 进程架构 | 单进程多线程 + 按需 spawn（方案 D） | [02-plan-d-vs-b](02-architecture-plan-d-vs-b.md) |
| 工具集 | 标准 8 工具 + Skills 可注册自定义工具 | [04-agent-framework](04-design-agent-framework.md) |
| 上下文管理 | 本地持久化（SQLite）+ 自动 Compaction | [04-agent-framework](04-design-agent-framework.md) |
| 代码编辑器 | Monaco Editor（语法高亮 / 编辑 / Diff 视图） | [05-ui-layout](05-design-ui-layout.md) |
| 预览系统 | 分屏混合（Markdown / HTML / CSV·JSON / React Dev / 图片 / PDF） | [05-ui-layout](05-design-ui-layout.md) |
| MVP 功能 | 线程管理 / 模型选择 / Open·Commit / Skills（含输入框 Skill 标签） / 快捷建议 | [05-ui-layout](05-design-ui-layout.md) |

## 3. 进程架构（方案 D）

所有 Agent Loop 跑在 Electron 主进程中，每个线程是一个 Agent 类实例（天然隔离）。共享 API Client 和连接池。只有 bash 命令才 spawn 子进程。

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                                                             │
│  ┌─── Shared ─────────────────────────────────────────────┐ │
│  │  API Client Pool  │  SQLite DB  │  Model Registry      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Thread 1 ──┐  ┌── Thread 2 ──┐  ┌── Thread N ──┐     │
│  │ Agent Loop    │  │ Agent Loop    │  │ Agent Loop    │     │
│  │ Messages[]    │  │ Messages[]    │  │ Messages[]    │     │
│  │ Abort Ctrl    │  │ Abort Ctrl    │  │ Abort Ctrl    │     │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘    │
│         │ spawn            │ spawn            │ spawn       │
│    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐        │
│    │ bash/zsh│        │ bash/zsh│        │ bash/zsh│        │
│    └─────────┘        └─────────┘        └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**选择理由：**
- Claude Code 已验证此模式可行
- 内存效率：10 线程 ~80MB vs 多进程方案 ~500MB
- API Client / Prompt Cache 天然共享
- Agent Loop 是 I/O 密集型（等 API），不需要多进程

详见 [02-architecture-plan-d-vs-b.md](02-architecture-plan-d-vs-b.md)

## 4. Agent 框架分层

```
App Layer (Electron)        — UI + IPC
    ↓
Coding Layer (领域层)       — 8 标准工具 + Skill 自定义工具 + Worktree
    ↓
Agent Layer (核心层)        — ReAct Loop + 中间件 + Compaction
    ↓
Foundation Layer (基础层)   — Model / Message / FunctionTool / Provider 接口
    ↑
Community Layer (适配器层)  — OpenAI Provider (MiniMax / GLM / ARK / OpenAI)
```

### 关键模块

| 模块 | 职责 |
|------|------|
| `Foundation/messages` | 统一消息类型（Text/Image/Thinking/ToolUse/ToolResult） |
| `Foundation/models` | Model 类 + ModelProvider 接口 + ModelContext |
| `Foundation/tools` | `defineTool()` 工厂 — Zod schema → JSON Schema |
| `Agent/agent` | ReAct Loop — stream() / think() / act() / abort() |
| `Agent/middleware` | 8 个生命周期钩子 |
| `Agent/compaction` | 上下文压缩引擎（shouldCompact / compact） |
| `Agent/skills` | SKILL.md 解析 + prompt 注入 + 自定义工具注册 |
| `Coding/tools` | bash / read_file / write_file / str_replace / glob / grep / list_dir / ask_user |
| `Coding/worktree` | Git Worktree 管理（create / remove / list / merge） |
| `Community/openai` | OpenAI 兼容 Provider（豆包/DeepSeek/Qwen/vLLM） |
| `Community/stream-types` | 共享流式事件类型（StreamCallback / StreamEvent） |

详见 [04-design-agent-framework.md](04-design-agent-framework.md)

## 5. UI 设计

### 三栏布局
- **Sidebar**（左 220px）— 线程列表 + Skills 列表
- **Chat Panel**（中 flex:1）— 消息流 + 输入框
- **Preview Panel**（右 380px，可收起）— 多模式预览

### 输入框
- `@` 触发 Skill 标签选择
- 模型选择器 + 执行力度
- Local / Worktree 模式切换
- `Cmd+Enter` 发送

### Preview Panel 类型
- **Monaco Code** — 语法高亮编辑，30+ 语言
- **Monaco Diff** — Agent 修改的前后对比
- **Markdown** — react-markdown 渲染，支持本地图片
- **React Dev** — iframe 加载 localhost dev server
- **Image** — 单张/画廊，AI 生成图片
- **PDF** — PDF.js 渲染
- **CSV/JSON** — 表格/可折叠树
- **HTML** — webview 渲染

### Titlebar
- Open — 打开/切换项目
- Commit — 一键 git commit + diff 统计

详见 [05-design-ui-layout.md](05-design-ui-layout.md) 和 [05-design-ui-layout.html](05-design-ui-layout.html)

## 6. 数据持久化

### SQLite 数据库

```
threads
├── id (TEXT PK)
├── title (TEXT)
├── project_path (TEXT)
├── model_id (TEXT)
├── mode (TEXT: 'local' | 'worktree')
├── created_at (INTEGER)
└── updated_at (INTEGER)

messages
├── id (TEXT PK)
├── thread_id (TEXT FK)
├── role (TEXT: 'system' | 'user' | 'assistant' | 'tool')
├── content (TEXT JSON)     — 序列化的 Content[] 数组
├── is_compact_boundary (INTEGER)
└── created_at (INTEGER)

skills
├── id (TEXT PK)
├── name (TEXT)
├── description (TEXT)
├── path (TEXT)             — SKILL.md 所在目录
└── enabled (INTEGER)
```

### 上下文压缩

当消息历史的 token 数超过阈值时自动触发：

```
阈值 = contextWindow - maxOutputTokens - bufferTokens
```

压缩流程：
1. 用独立的 Agent 实例生成对话摘要
2. 用 CompactBoundaryMessage 替换旧消息
3. 持久化压缩后的消息到 SQLite

## 7. 项目结构（预期）

```
tiny-codex/
├── package.json
├── electron.config.ts
├── tsconfig.json
│
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 入口
│   │   ├── ipc/                   # IPC handlers
│   │   ├── thread-manager.ts      # 线程管理
│   │   ├── db.ts                  # SQLite 数据库
│   │   └── window.ts              # 窗口管理
│   │
│   ├── renderer/                  # React 渲染进程
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── ChatPanel/
│   │   │   ├── PreviewPanel/
│   │   │   ├── InputBox/
│   │   │   └── Titlebar/
│   │   ├── hooks/
│   │   └── stores/
│   │
│   ├── foundation/                # Agent 基础层
│   │   ├── messages/
│   │   ├── models/
│   │   └── tools/
│   │
│   ├── agent/                     # Agent 核心层
│   │   ├── agent.ts
│   │   ├── middleware.ts
│   │   ├── compaction/
│   │   └── skills/
│   │
│   ├── coding/                    # 编码领域层
│   │   ├── agents/
│   │   ├── tools/
│   │   └── worktree/
│   │
│   └── community/                 # Provider 适配层
│       ├── openai/
│       └── stream-types.ts
│
├── skills/                        # 内置 Skills
│   ├── image-gen/
│   │   └── SKILL.md
│   └── tech-writer/
│       └── SKILL.md
│
└── docs/
    └── design/                    # 设计文档（本目录）
```

## 8. 核心依赖（预期）

```json
{
  "dependencies": {
    "electron": "^33.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "openai": "^6.x",
    "@anthropic-ai/sdk": "^0.x",
    "zod": "^4.x",
    "better-sqlite3": "^11.x",
    "monaco-editor": "^0.52.x",
    "react-markdown": "^9.x",
    "react-pdf": "^9.x",
    "fast-glob": "^3.x",
    "gray-matter": "^4.x"
  }
}
```

## 9. 设计文档索引

| 编号 | 文档 | 内容 |
|------|------|------|
| 01 | [architecture-approaches](01-architecture-approaches.md) | 方案 A/B/C 初始对比 |
| 02 | [architecture-plan-d-vs-b](02-architecture-plan-d-vs-b.md) | 方案 D vs B 最终选择 |
| 03 | [design-overview](03-design-overview.md) | 整体架构和决策汇总 |
| 04 | [design-agent-framework](04-design-agent-framework.md) | Agent 框架分层设计 |
| 05 | [design-ui-layout](05-design-ui-layout.md) | UI 布局和交互设计 |
| — | [design-ui-layout.html](05-design-ui-layout.html) | UI 可视化 mockup |
