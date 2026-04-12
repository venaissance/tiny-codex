# Suggestion Cards — Follow-up Action Buttons

## 目标
Agent 回复结束后，展示 2-3 个可点击的建议卡片，用户点击自动发送。

## 架构
- **SuggestionMiddleware** (`src/agent/middlewares/suggestions.ts`)
  - `afterAgentRun`: 从最后回复中提取建议问题
  - 如果没有建议，额外调一次 LLM 生成 2-3 条
  - 通过 IPC 推送到 renderer
- **IPC**: 新增 `AGENT_SUGGESTIONS` channel
- **UI**: `SuggestionCards.tsx` 渲染在最后一条消息下方

## UI 设计
```
┌──────────────────────────────────────────┐
│  🔄 换个标题  │  📝 调整语气  │  🎯 深入话题  │
└──────────────────────────────────────────┘
       ↓ 点击 = 自动填入输入框并发送
```

## 提取策略
1. 正则匹配最后回复中的疑问句（"需要...吗？", "要不要...？"）
2. 如果匹配到 → 拆分为独立建议
3. 如果没有 → 调 LLM: "Based on the conversation, suggest 3 follow-up actions"
