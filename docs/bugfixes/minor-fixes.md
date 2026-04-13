# Minor Fixes

Small bugfixes grouped together for reference.

---

## dev.sh Wrong Electron Entry Path
**Symptom**: `npm run dev` failed with "Cannot find module".
**Root Cause**: Script used `electron dist/main/index.js` but tsc output was `dist/main/main/index.js`.
**Fix**: `scripts/dev.sh` — corrected path.

---

## onStreamEnd Crash — rafId Scoping
**Symptom**: Intermittent crash when streaming ended.
**Root Cause**: `rafId` and `pendingText` declared outside `onStreamDelta` closure, inconsistent state on re-render.
**Fix**: Scoped variables inside the closure in `src/renderer/hooks/useAgent.ts`.

---

## Thinking Card Never Showed
**Symptom**: Thinking indicator never appeared during agent processing.
**Root Cause**: `MessageHistory` used `!!streamingText` as `isStreaming`. Empty string = falsy = card hidden.
**Fix**: Pass actual `isStreaming` boolean from store. `src/renderer/components/ChatPanel/MessageHistory.tsx`.

---

## GLM 404 — URL Double Slash
**Symptom**: GLM API returned 404, other providers worked fine.
**Root Cause**: `baseURL` trailing slash + `/chat/completions` = `v4//chat/completions`.
**Fix**: `this.baseURL = baseURL.replace(/\/+$/, '')` in `src/community/openai/provider.ts`.

---

## MiniMax Streaming Trailing "}
**Symptom**: Preview content had `"}` appended during single-chunk tool_use_delta.
**Root Cause**: Content extraction regex didn't strip JSON closing syntax.
**Fix**: `if (preview.endsWith('"}')) preview = preview.slice(0, -2)` in `src/renderer/hooks/useAgent.ts`.

---

## Preview Stale After Rename
**Symptom**: Preview showed "Cannot read file" after renaming in file explorer.
**Root Cause**: Preview held old file path; `readFile` failed on deleted path.
**Fix**: Auto-clear selection on read error in `src/renderer/App.tsx`.
