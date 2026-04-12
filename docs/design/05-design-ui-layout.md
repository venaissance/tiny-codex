# UI 布局与交互设计

## 整体布局：三栏结构

```
┌──────────────────────────────────────────────────────────────────────┐
│  Titlebar:  tiny-codex — project-name        [Open] [Commit] +12 -3 │
├─────────┬──────────────────────────┬─────────────────────────────────┤
│         │                          │                                 │
│ Sidebar │      Chat Panel          │      Preview Panel              │
│         │                          │                                 │
│ + New   │  Thread title            │  [Preview] [Code] [Diff]        │
│         │                          │                                 │
│ THREADS │  ┌──────────────────┐    │  ┌─────────────────────────┐   │
│ ✎ Task1 │  │ User message     │    │  │                         │   │
│ ✎ Task2 │  └──────────────────┘    │  │  Markdown / React Dev   │   │
│ 📄 Blog │                          │  │  Code (Monaco)          │   │
│         │  Thinking...             │  │  Diff (Monaco)          │   │
│ SKILLS  │  read_file: src/...      │  │  Image / PDF            │   │
│ 🎨 Img  │  Agent response text     │  │  CSV·JSON / HTML        │   │
│ 📝 Write│  Code diff block         │  │                         │   │
│ 🔍 Review│                         │  └─────────────────────────┘   │
│         │  ┌──────────────────┐    │                                 │
│         │  │ Input box        │    │                                 │
│         │  │ [+] Model ▾  ▾   │    │                                 │
│         │  │ [Local|Worktree] ↑│   │                                 │
│         │  └──────────────────┘    │                                 │
├─────────┴──────────────────────────┴─────────────────────────────────┤
```

## 三栏职责

### Sidebar（左 ~220px）
- **New thread** 按钮 — 创建新对话线程
- **Threads 列表** — 按时间排序，显示图标 + 标题 + 相对时间
- **Skills 列表** — 已安装的 Skills（Image Gen / Tech Writer / Code Review 等）
- 点击线程切换上下文，点击 Skill 可查看详情

### Chat Panel（中 flex:1）
- **Thread header** — 当前线程标题
- **Message history** — 消息流，包含以下渲染类型：
  - 用户消息（右对齐气泡）
  - Thinking block（灰色左边框，可折叠）
  - Tool call block（工具名 + 参数，monospace）
  - Code diff block（文件名 + 红绿 diff，内嵌 Monaco）
  - Agent 文本回复
- **Input area** — 底部输入区域（详见下方）

### Preview Panel（右 ~380px，可收起）
- **Tab 栏** — Preview / Code / Diff / Image / PDF（根据当前文件类型动态显示）
- **Preview body** — 根据 Tab 切换渲染模式
- 可通过拖拽调整宽度，双击边框收起/展开

## 输入框设计

```
┌─────────────────────────────────────────────────────┐
│ [🎨 Image Gen]  帮文章生成一张配图                    │
│                                                     │
│─────────────────────────────────────────────────────│
│ [+]  Claude Sonnet 4 ▾   High ▾   [Local|Worktree] ↑│
└─────────────────────────────────────────────────────┘
```

- **Skill 标签** — 用 `@` 触发 Skill 选择器，选中后显示为彩色标签（如 `🎨 Image Gen`）
- **文本输入** — 多行输入，Enter 发送，Shift+Enter 换行
- **底部工具栏：**
  - `+` 按钮 — 附加文件/图片
  - 模型选择器 — 下拉切换模型（Claude Sonnet 4 / GPT-4o / 豆包等）
  - 执行力度 — Low / Medium / High / Extra High
  - 模式切换 — Local / Worktree 分段按钮
  - 发送按钮 — 圆形蓝色上箭头

## Titlebar 设计

```
[●●●]  tiny-codex — my-react-app          [Open ▾]  [◇ Commit ▾]  +12 -3
```

- **Open** — 打开/切换项目目录
- **Commit** — 一键 git commit（显示当前 diff 统计）
- **+N -N** — 当前线程的文件变更统计

## 欢迎页

无项目打开或新线程时显示：
- 居中 Logo + "Let's build" 标题
- 底部 4 个快捷建议卡片：
  - Create a React page
  - Find and fix bugs
  - Write a tech blog
  - Generate images

## Preview Panel 预览类型

| 类型 | Tab 名 | 实现方式 | 触发条件 |
|------|--------|---------|---------|
| React Dev | Preview | iframe 加载 localhost:N | 检测到 dev server 运行中 |
| Markdown | Markdown | react-markdown + remark | 当前文件是 .md |
| Code | Code | Monaco Editor（只读/可编辑） | 任何代码文件 |
| Diff | Diff | Monaco DiffEditor | Agent 修改文件后 |
| Image | Image | `<img>` 标签 / 画廊组件 | .png/.jpg/.svg 或 AI 生成图片 |
| PDF | PDF | PDF.js / react-pdf | .pdf 文件 |
| CSV | Table | 表格渲染组件 | .csv 文件 |
| JSON | Tree | 可折叠树组件 | .json 文件 |
| HTML | HTML | webview / iframe | .html 文件 |

## 交互细节

### 消息渲染
- **Thinking** — 默认折叠，点击展开，灰色样式弱化
- **Tool call** — 显示工具名和关键参数，成功绿色/失败红色
- **Code diff** — 内嵌小型 diff 视图，点击可在 Preview Panel 全屏查看
- **图片** — Agent 生成的图片内嵌缩略图，点击在 Preview Panel 大图查看

### Skill 标签交互
1. 用户在输入框输入 `@` → 弹出 Skill 选择面板
2. 选择 Skill → 输入框前插入彩色标签（如 `🎨 Image Gen`）
3. Agent 运行时自动加载该 Skill 的工具和 prompt
4. 可通过 Backspace 删除标签

### 键盘快捷键
- `Cmd+N` — 新线程
- `Cmd+O` — 打开项目
- `Cmd+Enter` — 发送消息
- `Cmd+K` — 快速切换线程
- `Cmd+\` — 切换 Preview Panel 显示/隐藏
- `Cmd+Shift+D` — 切换 Diff 视图
