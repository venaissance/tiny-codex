# Suggestion Cards — Follow-up Action Buttons

## Status: IMPLEMENTED

## Goal
Agent reply ends with 2-3 clickable suggestion cards. Clicking sends the text as user input.

## Architecture

### Extraction strategy (SuggestionCards.tsx `extractSuggestions`)

Two-tier approach, model-generated preferred:

1. **HTML comment (preferred)** — System prompt instructs the model to append
   `<!-- suggestions: ["action 1", "action 2"] -->` at the end of its reply.
   Parsed via regex + `JSON.parse`. Invisible to the user.

2. **Regex fallback** — If no HTML comment found, scans the tail of the reply
   for a numbered/bulleted list preceded by a question prompt.
   Supports both Chinese (`你想`, `需要我`, `要不要`) and English
   (`Would you like`, `Should I`, etc.) patterns.

### IPC flow
- `SuggestionCards` component renders below the last assistant message
- Extraction runs client-side from message content (no extra LLM call)
- Hidden during streaming (`isStreaming` guard)

## Welcome Screen — QuickCards

Separate from suggestion cards. `QuickCards.tsx` shows preset quick-start
actions on the welcome page when a new thread has no messages.

- **Disabled** when no project is opened (`disabled={!projectPath}`)
- Clicking a card sends the text as the first user message

## UI
```
┌──────────────────────────────────────────┐
│  🔄 换个标题  │  📝 调整语气  │  🎯 深入话题  │
└──────────────────────────────────────────┘
       ↓ click = auto-send as user message
```
