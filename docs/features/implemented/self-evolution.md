# Self-Evolution v1 — Frozen-Snapshot Memory + Background Review

## 目标

让 tiny-codex 在持续使用中沉淀两种长期能力：
- **Memory** — 跨 session 记住的环境事实（工具技巧、项目约定）和用户画像（偏好、风格）
- **Skill** — agent 自主提炼的可复用工作流（需要用户审批）

灵感来自 Hermes Agent 的 background review pattern：response 交付后异步自检，不阻塞主流。

## 架构

### Phase 1 · 双存储 + Frozen Snapshot

- **存储**
  - `~/.tiny-codex/memory/MEMORY.md` — 全局环境记忆
  - `~/.tiny-codex/memory/USER.md`   — 用户画像（带 `<!-- LOCAL ONLY -->` 头，**永不上传**）
  - `<projectPath>/.codex/memory/MEMORY.md` — 项目级环境记忆，附加在全局之后
- **Frozen snapshot**：`createCodingAgent` session 启动时调用 `loadMemory()`，把 `<memory_snapshot>` 块拼接到 system prompt 顶部。整个 session 不再 reload，保护 prefix cache，避免 mid-session prompt 漂移。
- **写回**：`MemoryStore.append(target, line)` 用 fsync-style 原子 rename 串行追加；mid-session 写仅落盘，下一个 session 才生效。
- 实现：`src/agent/memory/`

### Phase 2 · BackgroundReviewMiddleware

- 注册在 `create-agent.ts` middlewares 数组末尾。
- 计数器：`turnsSinceMemory` (默认阈值 10) 和 `itersSinceSkill` (默认阈值 10)。
- 触达阈值后通过 `setImmediate` spawn review agent —— 独立的最小 agent：
  - 模型：`process.env.CODEX_REVIEW_MODEL || 'glm-4.5-flash'`（Q1）
  - 工具集：仅 `memory_write` 或 `skill_create`
  - **`middlewares: []`**：防递归（review-of-review）
- 每个 review 失败自含 try/catch，只 `console.error`，不影响主流。
- Trace 限制：tail 16 条消息；超时 60s。
- 实现：`src/agent/middlewares/background-review.ts` + `review-prompts.ts`

### Phase 3 · Skill 自创建（pending 队列，Q3）

- `skill_create` 工具校验：name 正则、description ≤ 200 字、6 类安全 pattern 拦截（curl-pipe-to-shell、destructive rm、eval、零宽字符、bidi 控制字符、scp/nc、permission bypass）。
- 通过校验的 skill 写入 `~/.tiny-codex/skills/_pending/<name>/SKILL.md`，**不**进入活跃 skills 目录，**不**被 `skills-middleware` 自动加载。
- 用户在 sidebar "PENDING SKILLS" 里看到，点 Confirm 后才 `mv` 到 `~/.tiny-codex/skills/<name>/`。
- IPC channels：`skill:listPending` / `skill:confirm` / `skill:reject`
- 实现：`src/agent/skills/skill-pending.ts` + `src/coding/tools/skill-create.ts` + `src/main/handlers/skill-pending.ts`

### Phase 4 · Toast 通知（Q2）

- BackgroundReview 完成后通过 `IPC.REVIEW_COMPLETE` 推送 `{memoriesAdded, skillsProposed, ...}` 到 renderer。
- `<ReviewToast>` 组件订阅事件、展示 4 秒自动消失的右下角轻提示。
- 同时刷新 PendingSkillList（通过 App 级 refreshKey）。

### Phase 5 · FTS5 全文搜索

- `messages_fts` virtual table 镜像 `messages.content`（同时存 message_id/thread_id/role/created_at 元数据）。
- `Database.searchMessages(query, limit)` 路由：
  - 检测 CJK → 走 LIKE（`unicode61` tokenizer 把 CJK 拆成单 codepoint，无意义）
  - 否则走 FTS5 + `snippet()` 高亮
- FTS5 创建失败时静默降级到纯 LIKE。
- IPC：`session:search`，preload 暴露 `api.searchMessages(query, limit)`

### Phase 6 · USER.md 本地化（Q4）

- USER.md 创建时自动注入 `<!-- LOCAL ONLY -->` 头与说明注释。
- 该文件存于 `~/.tiny-codex/`（home 目录），不在任何项目根，**默认不会被项目 git 提交**。
- **隐私边界来自"没有导出路径"，不是来自 header 注释**。v1 没有任何代码把 USER.md 写到磁盘以外的地方（没有 trajectory export、没有 session sync、没有 sharing），所以 USER.md 的内容只会被 `buildMemoryPrelude` 拼进当前 session 的 system prompt 进行本地推理。
- **`<!-- LOCAL ONLY -->` header 是文档，不是 enforcement**。它只是给读到这个文件的人/代码一个提示，**没有 runtime 过滤器**在检查它。如果未来加入 trajectory export / sync / share 任何出口路径，必须在**那个出口点**加真正的过滤逻辑（按文件路径排除 + 按内容头匹配），否则 USER.md 会被一并带走 —— 当前的 header 注释挡不住任何东西。
- **当前 v1 风险**：零（因为没有出口）。**未来风险点**：任何序列化 system prompt 或 memory snapshot 到外部的功能都会触发，必须配套加 export-time guard。

## 4 个关键决策对照

| 决策 | 选项 | 实现位置 |
|------|------|---------|
| Q1 review 模型 | `glm-4.5-flash`（默认，可改 `CODEX_REVIEW_MODEL`） | `background-review.ts:11` |
| Q2 用户感知 | Toast 通知 | `ReviewToast.tsx` + `IPC.REVIEW_COMPLETE` |
| Q3 Skill 审批 | Pending 队列 + 显式 Confirm/Reject | `skill-pending.ts` |
| Q4 USER.md 本地 | `~/.tiny-codex/memory/USER.md`（home 目录隔离 + 无导出路径；header 是文档不是 enforcement） | `store.ts:renderHeader` |

## 数据布局

```
~/.tiny-codex/
├── memory/
│   ├── MEMORY.md      # 环境记忆（可跨机器同步）
│   └── USER.md        # 用户画像（仅本机）
└── skills/
    ├── _pending/      # agent 提议、待用户审批
    │   └── <name>/SKILL.md
    └── <name>/        # 已激活，被 skills-middleware 加载
        └── SKILL.md
```

## 配置

- `CODEX_REVIEW_MODEL` — review agent 用的模型 ID（默认 `glm-4.5-flash`）
- `TINY_CODEX_HOME` — 测试与多账号场景下覆盖默认 `~/.tiny-codex`

## 未来工作

- Memory garbage collection（按访问频率裁剪过期条目）
- Skill 与 instinct 的统一 confidence 评分
- 把 review trigger 从固定阈值改为 information-gain 启发式
