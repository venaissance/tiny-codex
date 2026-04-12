# Changelog

## [1.0.0] - 2026-04-13

### Added
- ReAct agent loop with 8 built-in tools (bash, read_file, write_file, str_replace, glob, grep, list_dir, ask_user)
- Multi-provider support: MiniMax (OpenAI + reasoning_split), GLM, Doubao/ARK, OpenAI
- Real-time streaming output with rAF-batched rendering
- Live file preview during write_file (streaming tool preview)
- Expandable thinking card showing LLM reasoning in real-time
- Progress tracking sidebar (thinking -> tool call -> reflecting -> done)
- Rich preview panel: Monaco editor, Streamdown markdown, diff, image/PDF/CSV/JSON/HTML
- Skills system for custom tool extensions via markdown
- Git worktree mode for isolated execution
- Trajectory recording for agent step debugging
- SQLite persistence for threads and messages
- Mock provider for E2E testing (E2E_MOCK=1)
- 220 tests (unit + component + integration + E2E)

### Fixed
- Preview panel flickering caused by premature file-written dispatch
- Chat auto-scroll failing during streaming (smooth -> instant)
- IME composition conflict with Enter key submit
- Thread switch leaving stale streaming state
- GLM 404 from baseURL double-slash
