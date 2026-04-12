# TinyCodex

[English](#) | [中文](README.zh-CN.md)

A lightweight Electron-based AI coding assistant. Open local projects and let an LLM agent read, write, and execute code — with real-time streaming preview.

## Features

- **Agent-powered editing** — ReAct loop with 8 built-in tools (bash, read/write file, str_replace, glob, grep, list_dir, ask_user)
- **Multi-provider** — OpenAI-compatible (MiniMax, GLM, Doubao/ARK, OpenAI), with per-provider streaming control
- **Real-time streaming** — Token-by-token output with rAF-batched rendering, live file preview as agent writes
- **Thinking display** — Expandable reasoning card shows LLM thinking process in real-time
- **Rich preview** — Monaco editor, Streamdown markdown, diff view, image/PDF/CSV/JSON/HTML preview
- **Progress tracking** — Live sidebar showing agent steps (thinking → tool call → reflecting → done)
- **Skills system** — Extend agent capabilities via markdown-defined custom tools
- **Git worktree** — Isolated branch execution mode
- **Trajectory recording** — Full agent step history for debugging

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and configure API keys
cp .env.example .env

# Start development
pnpm run dev
```

### Supported Providers

| Provider | Env Variable | Streaming | Notes |
|----------|-------------|-----------|-------|
| MiniMax | `MINIMAX_API_KEY` | Yes | `reasoning_split=true` auto-enabled |
| GLM (ZhipuAI) | `GLM_API_KEY` | No | Non-streaming fallback |
| Doubao/ARK | `ARK_API_KEY` | Yes | ByteDance Volcano Engine |
| OpenAI | `OPENAI_API_KEY` | Yes | Native OpenAI |

## Architecture

```
Renderer (React)  ──IPC──  Main Process (Electron)
     │                          │
     ├── Zustand stores         ├── ThreadManager
     ├── useAgent hook          │   └── Agent.stream()
     ├── Streamdown/Monaco      │       ├── think() → Model.invoke()
     └── file-writing events    │       └── act()  → Tool.invoke()
                                └── SQLite (thread/message persistence)
```

**Four layers, strict top-down dependency:**

| Layer | Responsibility |
|-------|---------------|
| Foundation | Model/Provider interface, message types, `defineTool()` |
| Agent | ReAct loop, middleware chain (8 hooks), context compaction |
| Coding | 8 tool implementations, `createCodingAgent()` factory |
| App | Electron window, IPC handlers, React UI, preview panel |

### Streaming Pipeline

```
Provider SSE → onStream callback → IPC (AGENT_STREAM_DELTA) → useAgent hook
  text_delta      → rAF batch → appendStreamingText → chat auto-scroll
  thinking_delta  → appendStreamingThinking → expandable thinking card
  tool_use_start  → setAgentState('tool_calling') → indicator update
  tool_use_delta  → extract content from JSON → file-writing event → live preview
```

## Project Structure

```
src/
├── foundation/     # Model/Provider abstraction, message types, tool framework
├── agent/          # ReAct loop, middleware, compaction, trajectory
├── coding/         # 8 standard tools, agent factory, worktree manager
├── community/      # OpenAI + Mock providers, shared stream types
├── main/           # Electron main process, IPC, SQLite, window
├── renderer/       # React UI, Zustand stores, Streamdown rendering
└── shared/         # IPC channel constants
```

## Testing

```bash
# Unit + integration + component tests (220 tests)
pnpm test

# E2E with mock LLM (~10s, no API key needed)
npx playwright test tests/e2e/smoke.test.ts

# Streaming preview E2E (flicker-free verification)
npx playwright test tests/e2e/scenarios/streaming-preview.test.ts

# Live API tests (requires .env keys)
RUN_LIVE_TESTS=1 pnpm test -- tests/integration/live-api.test.ts
```

### Test Coverage

| Category | Tests | Scope |
|----------|-------|-------|
| Unit | 120+ | Agent loop, tools, providers, stores, streaming logic |
| Component | 55+ | MessageHistory, AgentProcess, Sidebar, Preview, InputBox |
| Integration | 14 | Thread manager, agent-tools, skills, live API |
| E2E | 5 scenarios | Smoke, streaming preview, full workflow |

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Electron 41, Node.js |
| UI | React 19, Zustand 5, Streamdown 2, Monaco Editor |
| Styling | Tailwind CSS v4, Shiki (syntax highlighting) |
| Build | Vite, TypeScript |
| Testing | Vitest, Playwright, Testing Library |
| Database | SQLite (sql.js) |

## Build & Package

```bash
# Production build
pnpm run build

# Package for macOS (directory)
pnpm run pack

# Full release build
pnpm run release
```

## License

[MIT](LICENSE)
