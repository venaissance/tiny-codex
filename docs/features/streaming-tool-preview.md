# Streaming Tool Preview — Live Preview During write_file

## Status: IMPLEMENTED

## Problem
When agent generates a long file (e.g., blog post), the user waits 60-90s
seeing only "Thinking..." while the LLM generates the file content as a
write_file tool_use parameter. The content only appears after tool execution.

## Solution: Extract content from tool_use_delta in real-time

### Architecture

1. **OpenAIModelProvider** (`src/community/openai/provider.ts`)
   - Forwards `tool_use_start` and `tool_use_delta` events via `onStream` callback
   - Supports `supportsStreaming` flag per provider (e.g., MiniMax=true, GLM=false)

2. **useAgent hook** (`src/renderer/hooks/useAgent.ts`)
   - On `tool_use_delta` for `write_file`/`str_replace`, accumulates JSON fragments
   - Extracts `content` field value using regex `/"content"\s*:\s*"/`
   - Dispatches `file-writing` CustomEvent with partial content + file path
   - On `tool_use_start`, immediately updates store to show tool name in indicator

3. **App.tsx** — rAF-throttled `file-writing` handler
   - Sets `previewContent` and `previewFile` for live preview
   - `isLivePreviewingRef` guard prevents disk reads from overwriting live content

4. **MarkdownView** — auto-scrolls as content grows

5. **file-written timing** — `pendingWrites` Map by toolUseId
   - Assistant message: only RECORDS the write path (does NOT dispatch event)
   - Tool result: matches by toolUseId, dispatches `file-written` (file now on disk)
   - Prevents flicker from premature disk reads

### UX Result
```
Before: [Thinking... 60s] → [instant preview]
After:  [Thinking 3s] → [live preview streaming 60s alongside LLM generation]
```

## Key Design Decisions

| Problem | Solution |
|---------|----------|
| tool_use_delta frequency causing flicker | rAF throttling in App.tsx handler |
| File not yet on disk when assistant msg arrives | pendingWrites Map defers file-written to tool result |
| Disk read overwrites streaming preview | isLivePreviewingRef guard |
| Content extraction from partial JSON | Regex match + incremental accumulation |
| GLM doesn't support streaming | supportsStreaming: false, falls back to non-streaming |
