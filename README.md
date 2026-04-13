<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="TinyCodex Logo" />
</p>

<h1 align="center">TinyCodex</h1>

<p align="center">
  <strong>Your local AI coding assistant that writes, previews, and ships — all from one window.</strong>
</p>

<p align="center">
  <a href="#who-is-this-for">Who is this for</a> &middot;
  <a href="#demo">Demo</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#learn-from-the-source">Learn</a> &middot;
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/venaissance/tiny-codex" alt="License" />
  <img src="https://img.shields.io/github/v/release/venaissance/tiny-codex" alt="Release" />
  <img src="https://img.shields.io/badge/tests-240%2B%20passed-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/platform-macOS-blue" alt="Platform" />
</p>

---

TinyCodex is a desktop app that turns any LLM into a coding agent. Point it at a local folder, describe what you want, and watch it read files, write code, run commands, and render the results — all in real-time.

No cloud. No subscription. Your API key, your machine, your code.

## Who is this for

| You are... | TinyCodex helps you... |
|-----------|----------------------|
| **A tech blogger** | Write a full blog post in markdown — watch it render live as the AI types, then save |
| **A coding beginner** | Describe what you want in plain language, see the AI read your project and write working code |
| **An office worker** | Generate HTML reports, todo apps, data analysis scripts without touching a terminal |
| **An agent developer** | Study a clean, readable ReAct implementation — 4-layer architecture, 8 middleware hooks, streaming pipeline |

## Demo

https://github.com/user-attachments/assets/d48351a3-be5d-4de1-a045-e8a7facb007f

<p align="center">
  <img src="docs/assets/tiny-codex-markdown.png" width="800" alt="TinyCodex — Markdown streaming preview" />
  <br/>
  <em>Ask "write a tech blog" — watch markdown render in the preview panel as the agent types</em>
</p>

<p align="center">
  <img src="docs/assets/tiny-codex-html.png" width="800" alt="TinyCodex — HTML preview with dark theme" />
  <br/>
  <em>Generate an HTML todo app — live preview with progress tracking and dark theme</em>
</p>

## Features

### What you see

- **Live streaming preview** — Files render in real-time as the agent writes them (Markdown, HTML, code, images, PDF, CSV)
- **Thinking card** — Expand to see the AI's reasoning process as it works
- **Task planning** — Agent breaks down your request into steps, checks them off as it goes
- **Welcome screen** — Quick-start cards when you open a new thread; disabled until you open a project
- **Suggestion buttons** — After each response, get smart follow-up actions you can click (model-generated or regex-extracted)
- **File explorer** — Tree view with create, rename, delete, and right-click context menu

### What powers it

- **ReAct agent loop** — Think → Act → Observe → Repeat. 8 built-in tools: bash, read/write file, str_replace, glob, grep, list_dir, ask_user
- **Streaming pipeline** — SSE → rAF batching → Streamdown rendering → auto-scroll. No flicker, no lag.
- **Multi-provider** — MiniMax, GLM, Doubao, OpenAI — any OpenAI-compatible API. Per-provider streaming control.
- **Middleware system** — 8 lifecycle hooks (beforeModel, afterToolUse, etc.). Planner and Skills are just middlewares.
- **Skills** — Drop a markdown file in `skills/` → agent gets a new tool. No code needed.
- **Worktree mode** — Run agent in an isolated git branch. Safe experimentation.

### Providers

| Provider | Streaming | Notes |
|----------|-----------|-------|
| MiniMax | Yes | Recommended. `reasoning_split=true` auto-enabled |
| GLM (ZhipuAI) | Yes | Streaming enabled (URL bug fixed) |
| Doubao/ARK | Yes | ByteDance Volcano Engine |
| OpenAI | Yes | Any OpenAI-compatible endpoint |

## Quick Start

```bash
git clone https://github.com/venaissance/tiny-codex.git
cd tiny-codex
pnpm install
cp .env.example .env   # add your API key (MiniMax recommended)
pnpm run dev            # uses vite build --watch (not dev server)
```

> **Note:** Dev mode runs `vite build --watch` instead of Vite dev server. This is required because `@tailwindcss/vite` doesn't compile utility classes in dev server mode with Tailwind v4.

**First thing to try:** Open a project folder, then click a quick-start card on the welcome screen. Watch the agent plan, write, and preview — all streaming.

### Download

> [TinyCodex-1.0.0-arm64.dmg](https://github.com/venaissance/tiny-codex/releases/download/v1.0.0/TinyCodex-1.0.0-arm64.dmg) (macOS Apple Silicon)

## Learn from the Source

TinyCodex is designed to be readable. If you're learning how to build AI agents, here's the guided tour:

### 1. Agent Loop (~200 lines)

`src/agent/agent.ts` — The complete ReAct loop. Read `stream()` to see how think → act → yield works.

### 2. Tool System (~20 lines each)

`src/coding/tools/` — Each tool is a single file: schema (Zod) + invoke function. Start with `bash.ts`.

### 3. Streaming Pipeline

`src/renderer/hooks/useAgent.ts` — How SSE deltas become pixels. Follow `text_delta` (chat), `thinking_delta` (thinking card), and `tool_use_delta` (live file preview).

### 4. Middleware

`src/agent/middleware.ts` (interface) + `src/agent/middlewares/planner.ts` (implementation) — How to intercept the agent loop. 8 hooks, each optional.

### 5. Provider Abstraction

`src/community/openai/provider.ts` — One file to add any OpenAI-compatible API. Handles streaming, non-streaming, tool calls, and thinking.

## Architecture

```mermaid
graph TB
    subgraph Renderer["Renderer (React + Zustand)"]
        useAgent["useAgent hook"]
        Chat["Chat Panel<br/><small>Streamdown</small>"]
        Preview["Preview Panel<br/><small>Monaco / Markdown / HTML</small>"]
        Sidebar["Sidebar<br/><small>Progress + Files</small>"]
        
        useAgent -->|text_delta| Chat
        useAgent -->|tool_use_delta| Preview
        useAgent -->|state change| Sidebar
    end

    subgraph Main["Main Process (Electron)"]
        TM["ThreadManager"]
        Agent["Agent<br/><small>ReAct Loop</small>"]
        DB["SQLite<br/><small>Threads + Messages</small>"]
        
        TM --> Agent
        TM --> DB
    end

    subgraph Agent_Internals["Agent Internals"]
        Think["think()<br/><small>Model.invoke()</small>"]
        Act["act()<br/><small>Tool.invoke()</small>"]
        MW["Middleware<br/><small>8 lifecycle hooks</small>"]
        
        Agent --> MW --> Think
        MW --> Act
    end

    subgraph Providers["Providers (OpenAI Compatible)"]
        MiniMax["MiniMax<br/><small>streaming + reasoning</small>"]
        GLM["GLM<br/><small>streaming</small>"]
        ARK["Doubao/ARK"]
        OAI["OpenAI"]
    end

    subgraph Tools["8 Built-in Tools"]
        bash & read_file & write_file & str_replace
        glob & grep & list_dir & ask_user
    end

    Renderer <-->|IPC| Main
    Think --> Providers
    Act --> Tools

    style Renderer fill:#e8f4fd,stroke:#4a90d9
    style Main fill:#f0f7e8,stroke:#6ab04c
    style Providers fill:#fef3e2,stroke:#f0932b
    style Tools fill:#f5e6ff,stroke:#9b59b6
```

**Four layers, strict top-down dependency:**

| Layer | What it does |
|-------|-------------|
| **Foundation** | Model/Provider interface, message types, `defineTool()` |
| **Agent** | ReAct loop, middleware chain (8 hooks), context compaction |
| **Coding** | Tool implementations, `createCodingAgent()` factory |
| **App** | Electron window, IPC handlers, React UI, preview panel |

## Project Structure

```
src/
├── foundation/     # Model/Provider abstraction, message types, tool framework
├── agent/          # ReAct loop, middleware, compaction, trajectory
│   └── middlewares/  # Planner, Skills (pluggable via middleware interface)
├── coding/         # 8 standard tools, agent factory, worktree manager
├── community/      # OpenAI + Mock providers, shared stream types
├── main/           # Electron main process, IPC, SQLite, window
├── renderer/       # React UI, Zustand stores, hooks, components
│   ├── hooks/        # useAgent (streaming), useThread (lifecycle)
│   └── components/   # ChatPanel, Sidebar, PreviewPanel, InputBox
└── shared/         # IPC channel constants
```

## Testing

```bash
pnpm test                # 240+ unit/component/integration tests
npx playwright test      # E2E with mock LLM (no API key needed)
```

| Category | Tests | What it covers |
|----------|-------|---------------|
| Unit | 130+ | Agent loop, tools, providers, stores, streaming events, planner middleware |
| Component | 60+ | AgentProcess, MessageHistory, Sidebar, Preview, InputBox, SuggestionCards, FileExplorer |
| Integration | 14 | ThreadManager, agent-tools, skills system |
| E2E | 5 scenarios | Smoke test, streaming preview, full workflow |

## Build

```bash
pnpm run build     # production build
pnpm run pack      # macOS .app (directory)
pnpm run release   # macOS .dmg
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code conventions, and PR guidelines.

## License

[MIT](LICENSE)
