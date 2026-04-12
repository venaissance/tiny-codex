<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="TinyCodex Logo" />
</p>

<h1 align="center">TinyCodex</h1>

<p align="center">
  <strong>Lightweight Electron AI coding assistant with real-time streaming preview</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#demo">Demo</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/venaissance/tiny-codex" alt="License" />
  <img src="https://img.shields.io/github/v/release/venaissance/tiny-codex" alt="Release" />
  <img src="https://img.shields.io/badge/tests-220%20passed-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/electron-41-blue" alt="Electron" />
</p>

---

Open a local project, chat with an LLM agent that reads, writes, and executes code. Watch files render in real-time as the agent types — markdown, HTML, code, and more.

## Demo

<p align="center">
  <a href="https://github.com/venaissance/tiny-codex/releases/download/v1.0.0/tiny-codex.mp4">
    <img src="docs/assets/tiny-codex-markdown.png" width="800" alt="TinyCodex Demo — Click to watch video" />
  </a>
  <br />
  <em>Real-time markdown streaming preview — <a href="https://github.com/venaissance/tiny-codex/releases/download/v1.0.0/tiny-codex.mp4">click to watch demo video</a></em>
</p>

<p align="center">
  <img src="docs/assets/tiny-codex-html.png" width="800" alt="TinyCodex — HTML preview with dark theme" />
  <br />
  <em>HTML live preview with progress tracking and dark theme</em>
</p>

## Features

**Agent**
- ReAct loop with 8 built-in tools — bash, read/write file, str_replace, glob, grep, list_dir, ask_user
- Skills system — extend agent capabilities via markdown-defined custom tools
- Trajectory recording — full step history for debugging

**Streaming**
- Token-by-token chat output with rAF-batched rendering
- Live file preview — see content appear in the preview panel as the agent writes
- Expandable thinking card — watch LLM reasoning in real-time
- Progress sidebar — thinking, tool call, reflecting, done

**Preview**
- Markdown (Streamdown + Shiki syntax highlighting)
- HTML (sandboxed iframe)
- Code (Monaco Editor with diff view)
- Image, PDF, CSV, JSON

**Providers**

| Provider | Streaming | Notes |
|----------|-----------|-------|
| MiniMax | Yes | `reasoning_split=true` auto-enabled |
| GLM (ZhipuAI) | No | Non-streaming fallback |
| Doubao/ARK | Yes | ByteDance Volcano Engine |
| OpenAI | Yes | Any OpenAI-compatible endpoint |

## Quick Start

```bash
pnpm install
cp .env.example .env   # add your API key
pnpm run dev
```

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
        GLM["GLM<br/><small>non-streaming</small>"]
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
| **App** | Electron window, IPC, React UI, preview panel |

## Project Structure

```
src/
├── foundation/     # Model/Provider abstraction, message types, tool framework
├── agent/          # ReAct loop, middleware, compaction, trajectory
├── coding/         # 8 standard tools, agent factory, worktree manager
├── community/      # OpenAI + Mock providers, shared stream types
├── main/           # Electron main process, IPC, SQLite, window
├── renderer/       # React UI, Zustand stores, hooks, components
└── shared/         # IPC channel constants
```

## Testing

```bash
pnpm test                # 220 unit/component/integration tests
npx playwright test      # E2E with mock LLM (no API key needed)
```

| Category | Tests | Coverage |
|----------|-------|---------|
| Unit | 120+ | Agent, tools, providers, stores, streaming logic |
| Component | 55+ | AgentProcess, MessageHistory, Sidebar, Preview, InputBox |
| Integration | 14 | ThreadManager, agent-tools, skills |
| E2E | 5 | Smoke, streaming preview, full workflow |

## Build

```bash
pnpm run build     # production build
pnpm run pack      # macOS .app (directory)
pnpm run release   # macOS .dmg
```

## License

[MIT](LICENSE)
