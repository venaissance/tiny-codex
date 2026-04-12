# tiny-codex

A lightweight Electron-based AI coding assistant. Open local projects, chat with an LLM agent that reads, writes, and executes code — with real-time preview.

## Features

- **Agent-powered editing** — ReAct loop with 8 built-in tools (bash, read/write file, str_replace, glob, grep, list_dir, ask_user)
- **Multi-provider** — Anthropic, OpenAI-compatible (MiniMax, GLM, Doubao), or any custom provider
- **Real-time streaming** — Token-by-token output with rAF-batched rendering
- **Rich preview** — Monaco editor, Streamdown markdown, diff view, image/PDF/CSV/HTML preview
- **Progress tracking** — Live sidebar showing agent steps (thinking → tool call → done)
- **Skills system** — Extend agent capabilities via markdown-defined custom tools
- **Git worktree** — Isolated branch execution mode
- **Trajectory recording** — Full agent step history for debugging

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and fill in your API keys
cp .env.example .env

# Start development
pnpm run dev
```

## Project Structure

```
src/
├── foundation/     # Model/Provider abstraction, message types, tool framework
├── agent/          # ReAct loop, middleware (8 hooks), compaction, trajectory
├── coding/         # 8 standard tools, agent factory, worktree manager
├── community/      # Anthropic + OpenAI + Mock providers
├── main/           # Electron main process, IPC, SQLite, window
├── renderer/       # React UI, Zustand stores, Streamdown rendering
└── shared/         # IPC channels, shared types
```

## Architecture

```
Renderer (React)  ←IPC→  Main Process (Electron)
     │                         │
     └── Zustand stores        └── ThreadManager
         useAgent hook              └── Agent.stream()
         Streamdown/Monaco              ├── think() → Model.invoke()
                                        └── act()  → Tool.invoke()
```

**Four layers, strict top-down dependency:**

| Layer | Responsibility |
|-------|---------------|
| Foundation | Model interface, message types, `defineTool()` |
| Agent | ReAct loop, middleware chain, context compaction |
| Coding | Tool implementations, `createCodingAgent()` factory |
| App | Electron window, IPC handlers, React UI |

## Testing

```bash
# Unit + integration + component tests (144 tests)
pnpm test

# E2E smoke test with mock LLM (~10s, no API key needed)
E2E_MOCK=1 npx playwright test tests/e2e/smoke.test.ts

# E2E with real API (requires .env keys)
npx playwright test tests/e2e/scenarios/real-agent-task.test.ts
```

## Tech Stack

- **Runtime**: Electron 41, Node.js
- **UI**: React 19, Zustand, Streamdown, Monaco Editor
- **Styling**: Tailwind CSS v4
- **Build**: Vite 8, TypeScript 6
- **Testing**: Vitest 4, Playwright, Testing Library
- **Database**: SQLite (sql.js)

## License

[MIT](LICENSE)
