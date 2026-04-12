# Contributing to tiny-codex

## Development Setup

```bash
pnpm install
cp .env.example .env   # Fill in API keys
pnpm run dev            # Start Electron + Vite dev server
```

## Code Style

- TypeScript strict mode
- Tailwind CSS v4 for styling
- Zustand for state management
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`)

## Testing

```bash
pnpm test                # Unit + integration + component (vitest)
pnpm run build           # Build check

# E2E (mock LLM, no API key needed)
E2E_MOCK=1 npx playwright test tests/e2e/smoke.test.ts
```

All tests must pass before submitting a PR.

## Project Structure

- `src/foundation/` — Core abstractions (don't import from upper layers)
- `src/agent/` — Agent loop, middleware, compaction
- `src/coding/` — Tools and agent factory
- `src/community/` — LLM provider implementations
- `src/main/` — Electron main process
- `src/renderer/` — React UI components

## Pull Requests

- One feature/fix per PR
- Include tests for new functionality
- Run `pnpm test` and `pnpm run build` before submitting
