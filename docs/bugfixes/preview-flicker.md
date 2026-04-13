# Preview Panel Flickering During Streaming

## Symptom
Preview panel content flickered violently during agent streaming — especially visible with MiniMax and GLM providers.

## Root Cause
`file-written` event was dispatched from assistant messages (which contain tool_use blocks with file paths) before the tool actually executed and wrote the file. This triggered disk reads that returned stale/empty content, alternating with live streaming preview.

## Fix
`pendingWrites` Map in useAgent.ts tracks `toolUseId → filePath` from assistant messages. The `file-written` event is only dispatched when the matching tool_result arrives (confirming the file was actually written to disk).

## Key Pattern
```
assistant msg (tool_use: write_file) → store in pendingWrites[toolUseId]
tool_result msg → lookup pendingWrites[toolUseId] → dispatch file-written → delete entry
```

## Key Files
- `src/renderer/hooks/useAgent.ts` (pendingWrites Map)
- `src/renderer/App.tsx` (isLivePreviewingRef guard)
