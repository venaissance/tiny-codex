# 方案 D vs 方案 B：最终架构选择

## 背景

研究了 Claude Code 和 Codex 的真实架构后发现：Agent Loop 本质上是 **I/O 密集型**（等 LLM API 响应），不是 CPU 密集型。多个线程共享同一个 Node.js 事件循环完全没问题，真正需要进程隔离的只有 bash 命令执行。

## 方案 B：每线程独立进程

```
┌────────────────────────────┐
│   Renderer (React UI)      │
└──────────┬─────────────────┘
           │ IPC
┌──────────▼─────────────────┐
│   Main Process (Electron)  │
│   ThreadManager + SQLite   │
└──┬─────────┬─────────┬─────┘
   │         │         │
┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│Fork 1│ │Fork 2│ │Fork 3│
│Agent │ │Agent │ │Agent │
│Loop  │ │Loop  │ │Loop  │
│+Tools│ │+Tools│ │+Tools│
│~50MB │ │~50MB │ │~50MB │
└──┬───┘ └──┬───┘ └──┬───┘
   │spawn   │spawn   │spawn
┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│bash  │ │bash  │ │bash  │
└──────┘ └──────┘ └──────┘
```

## 方案 D：单进程多线程 + 按需 spawn（受 Claude Code 启发）

```
┌────────────────────────────┐
│   Renderer (React UI)      │
└──────────┬─────────────────┘
           │ IPC
┌──────────▼─────────────────┐
│   Main Process (Electron)  │
│                            │
│  ┌──────────────────────┐  │
│  │ Shared Resources     │  │
│  │ • API Client Pool    │  │
│  │ • SQLite DB          │  │
│  │ • Model Registry     │  │
│  └──────────────────────┘  │
│                            │
│  ┌────┐ ┌────┐ ┌────┐     │
│  │ T1 │ │ T2 │ │ T3 │     │
│  │Loop│ │Loop│ │Loop│     │
│  │~2MB│ │~2MB│ │~2MB│     │
│  └─┬──┘ └─┬──┘ └─┬──┘     │
│    │  每个线程是一个        │
│    │  Agent 类实例          │
└────┼───────┼───────┼───────┘
     │spawn  │spawn  │spawn
  ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
  │bash │ │bash │ │bash │
  └─────┘ └─────┘ └─────┘
```

## 对比

| 对比维度 | 方案 B（多进程） | 方案 D（单进程） |
|---------|----------------|----------------|
| 10 个线程内存 | ~500MB | ~80MB（共享+消息） |
| 新线程启动 | ~500ms（fork+init） | ~1ms（new object） |
| API 连接复用 | 不可能 | 天然共享 |
| Bash 崩溃隔离 | 完全隔离 | 完全隔离（spawn） |
| Agent Loop 崩溃 | 仅影响单线程 | 需 try/catch 保护 |
| 实现复杂度 | 中等（IPC 协议） | 低（直接函数调用） |

## 方案 D 的 Cons 及解决方案

### 1. Agent Loop 里的 bug 可能影响所有线程

**风险极低。** Agent Loop 代码路径简单：调 API → 解析响应 → 执行工具 → 循环。每个步骤都是 async/await，每个线程的循环包在 try/catch 里，一个线程的异常不会传播。加 `process.on('uncaughtException')` 兜底。

### 2. 上下文隔离

**不需要 AsyncLocalStorage。** 直接用类实例隔离 — 每个线程就是一个 Agent 实例，持有自己的消息历史、工具状态、abort controller。纯 OOP，天然隔离。

### 3. CPU 密集操作（如大文件 diff）

用 Node.js **Worker Threads** 处理偶发的 CPU 密集任务。或者直接 spawn 原生工具（`diff`、`grep` 本身就是极快的 C 程序）。

## 最终决策

**选择方案 D** — Claude Code 已验证此模式可行，更轻量、更高效、实现更简单。
