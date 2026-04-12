# Streaming Tool Preview — Live Preview During write_file

## Problem
When agent generates a long file (e.g., blog post), the user waits 60-90s
seeing only "Thinking..." while the LLM generates the file content as a
write_file tool_use parameter. The content only appears after tool execution.

## Root Cause
Anthropic SSE stream sends `input_json_delta` events during tool_use generation,
containing fragments of the JSON input like:
```
{"path":"/tmp/blog.md","content":"# Node.js 入门\n## 什么是 Node.js\n...
```
We currently ignore these deltas — only the final complete tool_use is processed.

## Solution: Extract content from input_json_delta in real-time

### Changes needed:

1. **AnthropicModelProvider** (`src/community/anthropic/provider.ts`)
   - Forward `input_json_delta` events via `onStream` callback
   - Include the tool name from `content_block_start`

2. **useAgent hook** (`src/renderer/hooks/useAgent.ts`)
   - In `onStreamDelta`, detect `input_json_delta` for `write_file` tool
   - Accumulate JSON fragments, extract the `content` field value
   - Dispatch `file-writing` event with partial content

3. **PreviewPanel / MarkdownView**
   - Listen for `file-writing` events
   - Render partial content with Streamdown in real-time
   - On tool completion (`file-written`), switch to final file content

### Expected UX:
```
Before: [Thinking... 60s] → [instant preview]
After:  [Thinking 3s] → [live preview streaming 60s alongside LLM generation]
```

### Complexity
Medium — main challenge is parsing partial JSON from accumulated deltas
to extract the `content` field without waiting for complete JSON.

## Priority
High — directly impacts perceived performance for the most common use case.
