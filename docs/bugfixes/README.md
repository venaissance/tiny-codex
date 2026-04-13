# Bugfix Reference

## Major (dedicated docs)

| Bug | Root Cause | Date |
|-----|-----------|------|
| [Tailwind v4 dev mode](tailwind-v4-vite-dev.md) | @tailwindcss/vite doesn't compile utilities in serve mode | 2026-04-13 |
| [File explorer stale closure](file-explorer-stale-closure.md) | useCallback captured old tree state; find() false vs not-found | 2026-04-12 |
| [File explorer rename race](file-explorer-rename-race.md) | onBlur fires before async confirmRename completes | 2026-04-12 |
| [Preview flicker](preview-flicker.md) | file-written dispatched before tool execution | 2026-04-12 |

## Minor ([grouped](minor-fixes.md))

| Bug | One-liner |
|-----|-----------|
| dev.sh wrong entry path | tsc output at `dist/main/main/`, script pointed to `dist/main/` |
| onStreamEnd crash | rafId/pendingText scoped outside stream closure |
| Thinking card not showing | `!!streamingText` used as isStreaming |
| GLM 404 | baseURL trailing slash → double slash |
| MiniMax trailing `"}` | Content extraction didn't strip JSON closing |
| Preview stale after rename | Old file path retained after rename |
