# 架构方案对比

## 方案 A：单进程架构 — Agent 跑在 Electron 主进程

Agent 框架直接运行在 Electron main process，通过 IPC 与 React 渲染进程通信。

```
┌─────────────────────────────────┐
│     Renderer (React UI)         │
│  Threads │ Chat │ Model Picker  │
└──────────┬──────────────────────┘
           │ IPC
┌──────────▼──────────────────────┐
│     Main Process (Electron)     │
│  ┌───────────────────────────┐  │
│  │    Agent Framework        │  │
│  │  Foundation → Agent →     │  │
│  │  Coding → Tools           │  │
│  ├───────────────────────────┤  │
│  │  ThreadManager + SQLite   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Pros:**
- 架构最简单，无额外进程管理
- IPC 通信延迟低
- 文件系统访问直接（Node.js fs）
- 打包部署简单

**Cons:**
- Agent 执行 bash 命令时可能阻塞主进程
- 多线程并行受限
- 主进程崩溃 = 整个 App 崩溃

---

## 方案 B：双进程架构 — Agent 跑在独立子进程

Electron 主进程只做协调，Agent 框架运行在 fork 出的 Worker 子进程，每个线程一个 Worker。

```
┌─────────────────────────────────┐
│     Renderer (React UI)         │
│  Threads │ Chat │ Model Picker  │
└──────────┬──────────────────────┘
           │ IPC
┌──────────▼──────────────────────┐
│     Main Process (Electron)     │
│  ThreadManager + SQLite         │
│  WorkerPool (fork/kill)         │
└──┬──────────┬───────────────────┘
   │ stdio    │ stdio
┌──▼────┐  ┌──▼────┐
│Worker1│  │Worker2│  ...per thread
│ Agent │  │ Agent │
│ Tools │  │ Tools │
└───────┘  └───────┘
```

**Pros:**
- Agent 崩溃不影响 App 主体
- 多线程天然并行（每线程一个进程）
- bash 命令执行不阻塞 UI
- 可独立重启单个 Agent

**Cons:**
- 进程间通信略复杂（需要序列化消息）
- 内存占用更高（每个 Worker ~30-50MB）
- 调试稍困难

---

## 方案 C：混合架构 — 主进程 + Worker Thread

Agent 框架跑在 Node.js Worker Threads（非子进程），共享内存但独立执行。折中方案。

```
┌─────────────────────────────────┐
│     Renderer (React UI)         │
│  Threads │ Chat │ Model Picker  │
└──────────┬──────────────────────┘
           │ IPC
┌──────────▼──────────────────────┐
│     Main Process (Electron)     │
│  ThreadManager + SQLite         │
│  ┌─────────┐ ┌─────────┐       │
│  │ Worker  │ │ Worker  │ ...   │
│  │ Thread1 │ │ Thread2 │       │
│  │ Agent   │ │ Agent   │       │
│  └─────────┘ └─────────┘       │
└─────────────────────────────────┘
```

**Pros:**
- 比子进程更轻量（共享部分内存）
- 不阻塞主进程
- 通过 SharedArrayBuffer 可高效传数据
- Electron 原生支持

**Cons:**
- Worker Threads 不能直接 spawn 子进程（bash 工具需绕行）
- 错误隔离不如独立进程
- API 比 fork 更底层

---

## 结论

初步选择方案 B，后续在方案 D 对比中被替代。见 `02-architecture-plan-d-vs-b.md`。
