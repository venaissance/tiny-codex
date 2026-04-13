# Planning Middleware — PROGRESS To-Do List

## 目标
用户发消息后，Agent 先生成结构化任务计划，展示在 PROGRESS sidebar，执行时逐项打勾。

## 架构
- **PlannerMiddleware** (`src/agent/middlewares/planner.ts`)
  - `beforeModel`: 首次调用注入 "先输出 JSON 计划"
  - `afterModel`: 解析 `[PLAN]` JSON，通过 IPC 推送任务到 renderer
  - `afterToolUse`: 工具完成后匹配并标记对应任务为 done
- **IPC**: 新增 `AGENT_PLAN_UPDATE` channel
- **UI**: ProgressList 渲染 plan 任务而非 tool steps

## 任务格式
```json
[
  { "id": 1, "task": "Read current blog content", "status": "pending" },
  { "id": 2, "task": "Rewrite with new topic", "status": "pending" },
  { "id": 3, "task": "Save updated file", "status": "pending" }
]
```

## 参考
- LangChain plan-and-execute agent
- OpenAI Codex app 的 task timeline
