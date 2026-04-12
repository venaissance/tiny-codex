# tiny-codex 补充计划：Phase 缺口 + Phase 7-9

> 本文件补充主计划 `2026-04-11-tiny-codex-implementation.md` 中的测试缺口和未展开的 Phase 7-9。

---

## 补充 Phase 4：缺失的集成测试

### Task 4.6: Compaction 集成测试

**Files:**
- Test: `tests/integration/compaction.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/compaction.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Compactor } from '@/agent/compaction/compactor';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createUserMessage, createAssistantMessage } from '@/foundation/messages';
import type { NonSystemMessage } from '@/foundation/messages/types';

describe('Compaction Integration', () => {
  it('compacts long conversation into summary', async () => {
    // Mock provider returns a summary
    const provider = new MockModelProvider([{
      role: 'assistant',
      content: [{ type: 'text', text: 'Summary: User asked about Button component. Agent added loading prop.' }],
    }]);
    const model = new Model('test', provider);
    const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });

    // Build a long conversation
    const messages: NonSystemMessage[] = [];
    for (let i = 0; i < 50; i++) {
      messages.push(createUserMessage(`Question ${i}: ${'x'.repeat(100)}`));
      messages.push(createAssistantMessage([{ type: 'text', text: `Answer ${i}: ${'y'.repeat(200)}` }]));
    }

    const compacted = await compactor.compact(messages, model);

    // Should compress 100 messages into 1 summary message
    expect(compacted).toHaveLength(1);
    expect(compacted[0].role).toBe('user');
    expect(compacted[0].content[0].text).toContain('Summary');
  });

  it('shouldCompact returns true for messages exceeding threshold', () => {
    const compactor = new Compactor({ contextWindow: 1000, maxOutputTokens: 200, bufferTokens: 100 });
    // threshold = 1000 - 200 - 100 = 700 tokens (~2800 chars)
    const messages: NonSystemMessage[] = [
      createUserMessage('a'.repeat(3000)),
    ];
    expect(compactor.shouldCompact(messages)).toBe(true);
  });

  it('shouldCompact returns false for short messages', () => {
    const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });
    const messages: NonSystemMessage[] = [
      createUserMessage('hello'),
    ];
    expect(compactor.shouldCompact(messages)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/compaction.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/compaction.test.ts
git commit -m "test(integration): compaction engine with mock LLM"
```

---

### Task 4.7: Skills 系统集成测试

**Files:**
- Test: `tests/integration/skills-system.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/skills-system.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createSkillsMiddleware } from '@/agent/skills';
import { SkillToolRegistry } from '@/agent/skills/skill-tools';
import { defineTool } from '@/foundation/tools';
import { createUserMessage } from '@/foundation/messages';
import { z } from 'zod';
import path from 'path';

describe('Skills System Integration', () => {
  const skillsDir = path.resolve(__dirname, '../fixtures/sample-skills');

  it('skills middleware loads skills and injects into prompt', async () => {
    const provider = new MockModelProvider([{
      role: 'assistant',
      content: [{ type: 'text', text: 'I see the skills available.' }],
    }]);
    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'You are helpful.',
      middlewares: [createSkillsMiddleware([skillsDir])],
    });

    for await (const _ of agent.stream(createUserMessage('hi'))) {}

    // Verify the system prompt was modified to include skills
    const systemMsg = provider.invocations[0].messages[0] as any;
    expect(systemMsg.content[0].text).toContain('<skills>');
    expect(systemMsg.content[0].text).toContain('test-skill');
  });

  it('SkillToolRegistry registers and provides custom tools', () => {
    const registry = new SkillToolRegistry();
    const imageTool = defineTool({
      name: 'generate_image',
      description: 'Generate an image from a prompt',
      parameters: z.object({ prompt: z.string() }),
      invoke: async ({ prompt }) => `image_url_for: ${prompt}`,
    });

    registry.register(imageTool);
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('generate_image')).toBe(imageTool);

    registry.unregister('generate_image');
    expect(registry.getAll()).toHaveLength(0);
  });

  it('agent can use skill-registered custom tools', async () => {
    const imageTool = defineTool({
      name: 'generate_image',
      description: 'Generate an image',
      parameters: z.object({ prompt: z.string() }),
      invoke: async ({ prompt }) => `https://images.example.com/${encodeURIComponent(prompt)}.png`,
    });

    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c1', name: 'generate_image',
          input: { prompt: 'a cat coding' },
        }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Image generated!' }],
      },
    ]);
    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [imageTool],
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('generate a cat image'))) {
      messages.push(msg);
    }

    expect(messages).toHaveLength(3);
    expect(messages[1].content[0].content).toContain('images.example.com');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/integration/skills-system.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/skills-system.test.ts
git commit -m "test(integration): skills loading, custom tool registration, agent usage"
```

---

## 补充 Phase 5：缺失的测试

### Task 5.6: ask_user 工具测试

**Files:**
- Test: `tests/unit/coding/ask-user.test.ts`

- [ ] **Step 1: Write test**

Create `tests/unit/coding/ask-user.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { askUserTool, setAskUserHandler } from '@/coding/tools/ask-user';

describe('ask_user tool', () => {
  it('uses default handler when no UI is set', async () => {
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toContain('No UI available');
    expect(result).toContain('What color?');
  });

  it('uses custom handler when set', async () => {
    setAskUserHandler(async (q) => `User answered: blue to "${q}"`);
    const result = await askUserTool.invoke({ question: 'What color?' });
    expect(result).toBe('User answered: blue to "What color?"');

    // Reset to default
    setAskUserHandler(async (q) => `[No UI available] Question was: ${q}`);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/unit/coding/ask-user.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/coding/ask-user.test.ts
git commit -m "test(coding): add ask_user tool tests"
```

---

### Task 5.7: Git Worktree 管理器

**Files:**
- Create: `src/coding/worktree/manager.ts`
- Create: `src/coding/worktree/index.ts`
- Test: `tests/unit/coding/worktree.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/coding/worktree.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorktreeManager } from '@/coding/worktree/manager';
import { execSync } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('WorktreeManager', () => {
  let repoDir: string;
  let manager: WorktreeManager;

  beforeEach(async () => {
    // Create a temporary git repo
    repoDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-wt-'));
    execSync('git init', { cwd: repoDir });
    execSync('git config user.email "test@test.com"', { cwd: repoDir });
    execSync('git config user.name "Test"', { cwd: repoDir });
    await writeFile(join(repoDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: repoDir });
    manager = new WorktreeManager(repoDir);
  });

  afterEach(async () => {
    // Clean up worktrees before removing repo
    const worktrees = await manager.list();
    for (const wt of worktrees) {
      if (wt.path !== repoDir) {
        await manager.remove(wt.path);
      }
    }
    await rm(repoDir, { recursive: true, force: true });
  });

  it('creates a worktree', async () => {
    const wtPath = join(os.tmpdir(), `tiny-codex-wt-branch-${Date.now()}`);
    await manager.create(wtPath, 'test-branch');

    const worktrees = await manager.list();
    expect(worktrees.length).toBeGreaterThanOrEqual(2); // main + new

    await manager.remove(wtPath);
    await rm(wtPath, { recursive: true, force: true });
  });

  it('lists worktrees', async () => {
    const worktrees = await manager.list();
    expect(worktrees.length).toBeGreaterThanOrEqual(1);
    expect(worktrees[0].path).toBe(repoDir);
  });

  it('removes a worktree', async () => {
    const wtPath = join(os.tmpdir(), `tiny-codex-wt-rm-${Date.now()}`);
    await manager.create(wtPath, 'rm-branch');
    await manager.remove(wtPath);
    await rm(wtPath, { recursive: true, force: true });

    const worktrees = await manager.list();
    const paths = worktrees.map((w) => w.path);
    expect(paths).not.toContain(wtPath);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/coding/worktree.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement WorktreeManager**

Create `src/coding/worktree/manager.ts`:
```typescript
import { spawn } from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export class WorktreeManager {
  constructor(private repoPath: string) {}

  async create(path: string, branch: string): Promise<void> {
    await this.git(['worktree', 'add', '-b', branch, path]);
  }

  async remove(path: string): Promise<void> {
    await this.git(['worktree', 'remove', path, '--force']);
  }

  async list(): Promise<WorktreeInfo[]> {
    const output = await this.git(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.slice('worktree '.length) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice('branch refs/heads/'.length);
      }
    }
    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  }

  async merge(branch: string): Promise<string> {
    return this.git(['merge', branch]);
  }

  private git(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd: this.repoPath, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `git exited with code ${code}`));
      });
    });
  }
}
```

Create `src/coding/worktree/index.ts`:
```typescript
export { WorktreeManager } from './manager';
export type { WorktreeInfo } from './manager';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/coding/worktree.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/coding/worktree/ tests/unit/coding/worktree.test.ts
git commit -m "feat(coding): add WorktreeManager (create/remove/list/merge)"
```

---

## Phase 7: UI Components (TDD)

### Task 7.1: Vite + React renderer setup

**Files:**
- Create: `vite.config.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Install UI dependencies**

```bash
npm install zustand @monaco-editor/react react-markdown remark-gfm react-pdf
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: '../../dist/renderer',
  },
});
```

- [ ] **Step 3: Create renderer entry**

Create `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>tiny-codex</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

Create `src/renderer/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

Create `src/renderer/App.tsx`:
```tsx
import React from 'react';

export function App() {
  return <div className="app">tiny-codex</div>;
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `npx vite src/renderer --open`
Expected: Browser opens with "tiny-codex"

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/renderer/
git commit -m "feat(renderer): set up Vite + React renderer shell"
```

---

### Task 7.2: Zustand stores

**Files:**
- Create: `src/renderer/stores/thread-store.ts`
- Create: `src/renderer/stores/ui-store.ts`
- Test: `tests/unit/renderer/thread-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/thread-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useThreadStore } from '@/renderer/stores/thread-store';

describe('ThreadStore', () => {
  beforeEach(() => {
    useThreadStore.setState({
      threads: [],
      activeThreadId: null,
      messages: [],
      isStreaming: false,
    });
  });

  it('adds a thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    expect(useThreadStore.getState().threads).toHaveLength(1);
  });

  it('sets active thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    store.setActiveThread('t1');
    expect(useThreadStore.getState().activeThreadId).toBe('t1');
  });

  it('removes a thread', () => {
    const store = useThreadStore.getState();
    store.addThread({ id: 't1', title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local', createdAt: Date.now(), updatedAt: Date.now() });
    store.removeThread('t1');
    expect(useThreadStore.getState().threads).toHaveLength(0);
  });

  it('appends a message', () => {
    const store = useThreadStore.getState();
    store.appendMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    expect(useThreadStore.getState().messages).toHaveLength(1);
  });

  it('sets streaming state', () => {
    const store = useThreadStore.getState();
    store.setStreaming(true);
    expect(useThreadStore.getState().isStreaming).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/renderer/thread-store.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement stores**

Create `src/renderer/stores/thread-store.ts`:
```typescript
import { create } from 'zustand';

export interface Thread {
  id: string;
  title: string;
  projectPath: string;
  modelId: string;
  mode: 'local' | 'worktree';
  createdAt: number;
  updatedAt: number;
}

export interface ThreadMessage {
  role: string;
  content: Array<{ type: string; [key: string]: any }>;
}

interface ThreadState {
  threads: Thread[];
  activeThreadId: string | null;
  messages: ThreadMessage[];
  isStreaming: boolean;
  addThread: (thread: Thread) => void;
  removeThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  setMessages: (messages: ThreadMessage[]) => void;
  appendMessage: (message: ThreadMessage) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useThreadStore = create<ThreadState>((set) => ({
  threads: [],
  activeThreadId: null,
  messages: [],
  isStreaming: false,
  addThread: (thread) => set((s) => ({ threads: [...s.threads, thread] })),
  removeThread: (id) => set((s) => ({ threads: s.threads.filter((t) => t.id !== id) })),
  setActiveThread: (id) => set({ activeThreadId: id }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
}));
```

Create `src/renderer/stores/ui-store.ts`:
```typescript
import { create } from 'zustand';

interface UIState {
  previewVisible: boolean;
  previewTab: 'preview' | 'code' | 'diff' | 'markdown' | 'image' | 'pdf';
  previewFile: string | null;
  sidebarWidth: number;
  togglePreview: () => void;
  setPreviewTab: (tab: UIState['previewTab']) => void;
  setPreviewFile: (file: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  previewVisible: true,
  previewTab: 'preview',
  previewFile: null,
  sidebarWidth: 220,
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  setPreviewTab: (tab) => set({ previewTab: tab }),
  setPreviewFile: (file) => set({ previewFile: file }),
}));
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/thread-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/ tests/unit/renderer/
git commit -m "feat(renderer): add Zustand stores (thread-store, ui-store)"
```

---

### Task 7.3: Welcome + QuickCards 组件

**Files:**
- Create: `src/renderer/components/Welcome/Welcome.tsx`
- Create: `src/renderer/components/Welcome/QuickCards.tsx`
- Test: `tests/unit/renderer/welcome.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/welcome.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Welcome } from '@/renderer/components/Welcome/Welcome';

describe('Welcome', () => {
  it('renders welcome title', () => {
    render(<Welcome onQuickAction={vi.fn()} />);
    expect(screen.getByText("Let's build")).toBeInTheDocument();
  });

  it('renders quick action cards', () => {
    render(<Welcome onQuickAction={vi.fn()} />);
    expect(screen.getByText('Create a React page')).toBeInTheDocument();
    expect(screen.getByText('Find and fix bugs')).toBeInTheDocument();
    expect(screen.getByText('Write a tech blog')).toBeInTheDocument();
    expect(screen.getByText('Generate images')).toBeInTheDocument();
  });

  it('calls onQuickAction when card is clicked', () => {
    const onQuickAction = vi.fn();
    render(<Welcome onQuickAction={onQuickAction} />);
    fireEvent.click(screen.getByText('Create a React page'));
    expect(onQuickAction).toHaveBeenCalledWith('Create a React page');
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/renderer/welcome.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Welcome + QuickCards**

Create `src/renderer/components/Welcome/QuickCards.tsx`:
```tsx
import React from 'react';

const CARDS = [
  { icon: '💻', title: 'Create a React page', desc: 'Build a new component from scratch' },
  { icon: '🔍', title: 'Find and fix bugs', desc: 'Scan codebase for issues' },
  { icon: '📝', title: 'Write a tech blog', desc: 'Generate Markdown article' },
  { icon: '🎨', title: 'Generate images', desc: 'Create visuals with AI' },
];

export function QuickCards({ onSelect }: { onSelect: (title: string) => void }) {
  return (
    <div className="quick-cards">
      {CARDS.map((card) => (
        <button key={card.title} className="quick-card" onClick={() => onSelect(card.title)}>
          <span className="quick-card-icon">{card.icon}</span>
          <span className="quick-card-title">{card.title}</span>
          <span className="quick-card-desc">{card.desc}</span>
        </button>
      ))}
    </div>
  );
}
```

Create `src/renderer/components/Welcome/Welcome.tsx`:
```tsx
import React from 'react';
import { QuickCards } from './QuickCards';

export function Welcome({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  return (
    <div className="welcome">
      <div className="welcome-icon">🚀</div>
      <h1 className="welcome-title">Let's build</h1>
      <p className="welcome-sub">Open a project or start a new thread</p>
      <QuickCards onSelect={onQuickAction} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/welcome.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Welcome/ tests/unit/renderer/welcome.test.tsx
git commit -m "feat(renderer): add Welcome page + QuickCards component"
```

---

### Task 7.4: Sidebar 组件

**Files:**
- Create: `src/renderer/components/Sidebar/Sidebar.tsx`
- Create: `src/renderer/components/Sidebar/ThreadList.tsx`
- Create: `src/renderer/components/Sidebar/SkillList.tsx`
- Test: `tests/unit/renderer/sidebar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/sidebar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreadList } from '@/renderer/components/Sidebar/ThreadList';
import { SkillList } from '@/renderer/components/Sidebar/SkillList';

describe('ThreadList', () => {
  const threads = [
    { id: 't1', title: 'Fix navbar', updatedAt: Date.now() },
    { id: 't2', title: 'Write blog', updatedAt: Date.now() - 3600000 },
  ];

  it('renders thread titles', () => {
    render(<ThreadList threads={threads} activeId="t1" onSelect={vi.fn()} />);
    expect(screen.getByText('Fix navbar')).toBeInTheDocument();
    expect(screen.getByText('Write blog')).toBeInTheDocument();
  });

  it('highlights active thread', () => {
    render(<ThreadList threads={threads} activeId="t1" onSelect={vi.fn()} />);
    const active = screen.getByText('Fix navbar').closest('[data-active]');
    expect(active?.getAttribute('data-active')).toBe('true');
  });

  it('calls onSelect when thread is clicked', () => {
    const onSelect = vi.fn();
    render(<ThreadList threads={threads} activeId="t1" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Write blog'));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });
});

describe('SkillList', () => {
  const skills = [
    { name: 'Image Gen', icon: '🎨' },
    { name: 'Code Review', icon: '🔍' },
  ];

  it('renders skill names', () => {
    render(<SkillList skills={skills} />);
    expect(screen.getByText('Image Gen')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement ThreadList + SkillList**

Create `src/renderer/components/Sidebar/ThreadList.tsx`:
```tsx
import React from 'react';

interface Thread { id: string; title: string; updatedAt: number; }

export function ThreadList({ threads, activeId, onSelect }: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="thread-list">
      {threads.map((t) => (
        <div
          key={t.id}
          className={`sidebar-item ${t.id === activeId ? 'active' : ''}`}
          data-active={t.id === activeId}
          onClick={() => onSelect(t.id)}
        >
          <span className="sidebar-item-icon">✎</span>
          {t.title}
        </div>
      ))}
    </div>
  );
}
```

Create `src/renderer/components/Sidebar/SkillList.tsx`:
```tsx
import React from 'react';

interface Skill { name: string; icon: string; }

export function SkillList({ skills }: { skills: Skill[] }) {
  return (
    <div className="skill-list">
      {skills.map((s) => (
        <div key={s.name} className="sidebar-item">
          <span className="sidebar-item-icon">{s.icon}</span>
          {s.name}
        </div>
      ))}
    </div>
  );
}
```

Create `src/renderer/components/Sidebar/Sidebar.tsx`:
```tsx
import React from 'react';
import { ThreadList } from './ThreadList';
import { SkillList } from './SkillList';

export function Sidebar({ threads, skills, activeThreadId, onSelectThread, onNewThread }: {
  threads: Array<{ id: string; title: string; updatedAt: number }>;
  skills: Array<{ name: string; icon: string }>;
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}) {
  return (
    <aside className="sidebar">
      <button className="sidebar-btn" onClick={onNewThread}>+ New thread</button>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Threads</div>
        <ThreadList threads={threads} activeId={activeThreadId} onSelect={onSelectThread} />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Skills</div>
        <SkillList skills={skills} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/renderer/sidebar.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar/ tests/unit/renderer/sidebar.test.tsx
git commit -m "feat(renderer): add Sidebar with ThreadList + SkillList"
```

---

### Task 7.5: MessageHistory 组件

**Files:**
- Create: `src/renderer/components/ChatPanel/MessageBubble.tsx`
- Create: `src/renderer/components/ChatPanel/ThinkingBlock.tsx`
- Create: `src/renderer/components/ChatPanel/ToolCallBlock.tsx`
- Create: `src/renderer/components/ChatPanel/DiffBlock.tsx`
- Create: `src/renderer/components/ChatPanel/MessageHistory.tsx`
- Test: `tests/unit/renderer/message-history.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/message-history.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageHistory } from '@/renderer/components/ChatPanel/MessageHistory';

describe('MessageHistory', () => {
  it('renders user message as bubble', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'Hello agent' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('Hello agent')).toBeInTheDocument();
  });

  it('renders assistant text', () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'text', text: 'I can help!' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('I can help!')).toBeInTheDocument();
  });

  it('renders thinking block', () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'Let me think...' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('Let me think...')).toBeInTheDocument();
  });

  it('renders tool call block', () => {
    const messages = [
      { role: 'assistant', content: [
        { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: '/src/App.tsx' } },
      ]},
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('read_file')).toBeInTheDocument();
    expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
  });

  it('renders tool result', () => {
    const messages = [
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 'c1', content: 'File read OK' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('File read OK')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement message components** (MessageBubble, ThinkingBlock, ToolCallBlock, DiffBlock, MessageHistory — each rendering the corresponding content type)

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/renderer/message-history.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ChatPanel/ tests/unit/renderer/message-history.test.tsx
git commit -m "feat(renderer): add MessageHistory with all message type renderers"
```

---

### Task 7.6: InputBox 组件（含 Skill 标签）

**Files:**
- Create: `src/renderer/components/InputBox/InputBox.tsx`
- Create: `src/renderer/components/InputBox/SkillTagPicker.tsx`
- Create: `src/renderer/components/InputBox/ModelPicker.tsx`
- Create: `src/renderer/components/InputBox/ModePicker.tsx`
- Test: `tests/unit/renderer/input-box.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/input-box.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputBox } from '@/renderer/components/InputBox/InputBox';

describe('InputBox', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onAbort: vi.fn(),
    isStreaming: false,
    skills: [{ name: 'Image Gen', icon: '🎨' }, { name: 'Code Review', icon: '🔍' }],
    models: ['Claude Sonnet 4', 'GPT-4o'],
    currentModel: 'Claude Sonnet 4',
    onModelChange: vi.fn(),
    mode: 'local' as const,
    onModeChange: vi.fn(),
  };

  it('renders input area', () => {
    render(<InputBox {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument();
  });

  it('sends message on submit', async () => {
    const onSend = vi.fn();
    render(<InputBox {...defaultProps} onSend={onSend} />);
    const input = screen.getByPlaceholderText(/Ask anything/i);
    await userEvent.type(input, 'hello');
    fireEvent.submit(input.closest('form')!);
    expect(onSend).toHaveBeenCalledWith('hello', []);
  });

  it('shows skill picker on @ input', async () => {
    render(<InputBox {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Ask anything/i);
    await userEvent.type(input, '@');
    expect(screen.getByText('Image Gen')).toBeInTheDocument();
  });

  it('inserts skill tag when selected', async () => {
    render(<InputBox {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Ask anything/i);
    await userEvent.type(input, '@');
    fireEvent.click(screen.getByText('Image Gen'));
    expect(screen.getByText('🎨 Image Gen')).toBeInTheDocument();
  });

  it('shows model picker', () => {
    render(<InputBox {...defaultProps} />);
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument();
  });

  it('shows mode toggle', () => {
    render(<InputBox {...defaultProps} />);
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Worktree')).toBeInTheDocument();
  });

  it('switches mode', () => {
    const onModeChange = vi.fn();
    render(<InputBox {...defaultProps} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByText('Worktree'));
    expect(onModeChange).toHaveBeenCalledWith('worktree');
  });
});
```

- [ ] **Step 2: Implement InputBox + sub-components**

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/renderer/input-box.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/InputBox/ tests/unit/renderer/input-box.test.tsx
git commit -m "feat(renderer): add InputBox with SkillTagPicker, ModelPicker, ModePicker"
```

---

### Task 7.7: Titlebar 组件

**Files:**
- Create: `src/renderer/components/Titlebar/Titlebar.tsx`
- Test: `tests/unit/renderer/titlebar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/titlebar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Titlebar } from '@/renderer/components/Titlebar/Titlebar';

describe('Titlebar', () => {
  it('renders project name', () => {
    render(<Titlebar projectName="my-app" diffStats={{ added: 5, removed: 2 }} onOpen={vi.fn()} onCommit={vi.fn()} />);
    expect(screen.getByText(/my-app/)).toBeInTheDocument();
  });

  it('renders diff stats', () => {
    render(<Titlebar projectName="my-app" diffStats={{ added: 5, removed: 2 }} onOpen={vi.fn()} onCommit={vi.fn()} />);
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('calls onOpen when Open button clicked', () => {
    const onOpen = vi.fn();
    render(<Titlebar projectName="my-app" diffStats={{ added: 0, removed: 0 }} onOpen={onOpen} onCommit={vi.fn()} />);
    fireEvent.click(screen.getByText('Open'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('calls onCommit when Commit button clicked', () => {
    const onCommit = vi.fn();
    render(<Titlebar projectName="my-app" diffStats={{ added: 3, removed: 1 }} onOpen={vi.fn()} onCommit={onCommit} />);
    fireEvent.click(screen.getByText('Commit'));
    expect(onCommit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement Titlebar**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/renderer/components/Titlebar/ tests/unit/renderer/titlebar.test.tsx
git commit -m "feat(renderer): add Titlebar with Open/Commit/DiffStats"
```

---

## Phase 8: Preview System (TDD)

### Task 8.1: PreviewPanel shell + tab switching

**Files:**
- Create: `src/renderer/components/PreviewPanel/PreviewPanel.tsx`
- Test: `tests/unit/renderer/preview-panel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/renderer/preview-panel.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPanel } from '@/renderer/components/PreviewPanel/PreviewPanel';

describe('PreviewPanel', () => {
  it('renders tab bar', () => {
    render(<PreviewPanel file="/tmp/test.md" content="# Hello" />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('auto-selects Markdown tab for .md files', () => {
    render(<PreviewPanel file="/tmp/test.md" content="# Hello" />);
    expect(screen.getByText('# Hello').closest('.markdown-view')).toBeTruthy();
  });

  it('auto-selects Code tab for .ts files', () => {
    render(<PreviewPanel file="/tmp/test.ts" content="const x = 1;" />);
    // Monaco editor should be rendered
    expect(screen.getByTestId('monaco-view')).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(<PreviewPanel file="/tmp/test.md" content="# Hello" />);
    fireEvent.click(screen.getByText('Code'));
    expect(screen.getByTestId('monaco-view')).toBeInTheDocument();
  });

  it('renders image for image files', () => {
    render(<PreviewPanel file="/tmp/photo.png" content="" />);
    expect(screen.getByTestId('image-view')).toBeInTheDocument();
  });

  it('renders PDF viewer for .pdf files', () => {
    render(<PreviewPanel file="/tmp/doc.pdf" content="" />);
    expect(screen.getByTestId('pdf-view')).toBeInTheDocument();
  });

  it('renders CSV as table', () => {
    render(<PreviewPanel file="/tmp/data.csv" content="name,age\nAlice,30\nBob,25" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders JSON as tree', () => {
    render(<PreviewPanel file="/tmp/data.json" content='{"key": "value"}' />);
    expect(screen.getByText('"key"')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement PreviewPanel with file type detection + tab routing**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/renderer/components/PreviewPanel/ tests/unit/renderer/preview-panel.test.tsx
git commit -m "feat(renderer): add PreviewPanel with file type detection + tab switching"
```

---

### Task 8.2: Monaco Editor 视图

**Files:**
- Create: `src/renderer/components/PreviewPanel/MonacoView.tsx`
- Create: `src/renderer/components/PreviewPanel/DiffView.tsx`
- Test: `tests/unit/renderer/monaco-view.test.tsx`

- [ ] **Step 1: Write tests**

Create `tests/unit/renderer/monaco-view.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonacoView } from '@/renderer/components/PreviewPanel/MonacoView';
import { DiffView } from '@/renderer/components/PreviewPanel/DiffView';

describe('MonacoView', () => {
  it('renders with correct language detection', () => {
    render(<MonacoView file="/src/App.tsx" content="const x = 1;" />);
    expect(screen.getByTestId('monaco-view')).toBeInTheDocument();
  });

  it('detects TypeScript from .tsx extension', () => {
    const { container } = render(<MonacoView file="/src/App.tsx" content="" />);
    expect(container.querySelector('[data-language="typescript"]')).toBeTruthy();
  });
});

describe('DiffView', () => {
  it('renders diff between original and modified', () => {
    render(
      <DiffView
        file="/src/App.tsx"
        original="const x = 1;"
        modified="const x = 42;"
      />
    );
    expect(screen.getByTestId('diff-view')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement using @monaco-editor/react**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/renderer/components/PreviewPanel/MonacoView.tsx src/renderer/components/PreviewPanel/DiffView.tsx tests/unit/renderer/monaco-view.test.tsx
git commit -m "feat(renderer): add Monaco code editor + diff viewer"
```

---

### Task 8.3: Markdown 预览（含本地图片）

**Files:**
- Create: `src/renderer/components/PreviewPanel/MarkdownView.tsx`
- Test: `tests/unit/renderer/markdown-view.test.tsx`

- [ ] **Step 1: Write tests**

Create `tests/unit/renderer/markdown-view.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownView } from '@/renderer/components/PreviewPanel/MarkdownView';

describe('MarkdownView', () => {
  it('renders markdown heading', () => {
    render(<MarkdownView content="# Hello World" basePath="/tmp" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders code blocks with syntax highlighting', () => {
    const md = '```typescript\nconst x = 1;\n```';
    render(<MarkdownView content={md} basePath="/tmp" />);
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('resolves relative image paths to absolute', () => {
    const md = '![photo](./images/cat.png)';
    const { container } = render(<MarkdownView content={md} basePath="/project" />);
    const img = container.querySelector('img');
    expect(img?.src).toContain('/project/images/cat.png');
  });

  it('renders inline code', () => {
    render(<MarkdownView content="Use `useState` hook" basePath="/tmp" />);
    expect(screen.getByText('useState')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement using react-markdown + remark-gfm**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/renderer/components/PreviewPanel/MarkdownView.tsx tests/unit/renderer/markdown-view.test.tsx
git commit -m "feat(renderer): add Markdown preview with local image support"
```

---

### Task 8.4: Image / PDF / CSV·JSON / HTML 预览

**Files:**
- Create: `src/renderer/components/PreviewPanel/ImageView.tsx`
- Create: `src/renderer/components/PreviewPanel/PdfView.tsx`
- Create: `src/renderer/components/PreviewPanel/CsvJsonView.tsx`
- Create: `src/renderer/components/PreviewPanel/HtmlView.tsx`
- Test: `tests/unit/renderer/preview-types.test.tsx`

- [ ] **Step 1: Write tests**

Create `tests/unit/renderer/preview-types.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageView } from '@/renderer/components/PreviewPanel/ImageView';
import { CsvJsonView } from '@/renderer/components/PreviewPanel/CsvJsonView';

describe('ImageView', () => {
  it('renders single image', () => {
    render(<ImageView src="/tmp/photo.png" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
  });

  it('renders gallery for multiple images', () => {
    render(<ImageView src={['/tmp/a.png', '/tmp/b.png']} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
  });
});

describe('CsvJsonView', () => {
  it('renders CSV as table', () => {
    render(<CsvJsonView type="csv" content="name,age\nAlice,30\nBob,25" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders JSON as collapsible tree', () => {
    render(<CsvJsonView type="json" content='{"users":[{"name":"Alice"}]}' />);
    expect(screen.getByText(/"users"/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement all preview components**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/renderer/components/PreviewPanel/ tests/unit/renderer/preview-types.test.tsx
git commit -m "feat(renderer): add Image, PDF, CSV/JSON, HTML preview components"
```

---

## Phase 9: IPC Wiring + E2E Tests

### Task 9.1: IPC handlers（主进程 → Agent 桥接）

**Files:**
- Create: `src/main/thread-manager.ts`
- Create: `src/main/ipc/handlers.ts`
- Create: `src/main/ipc/thread-handlers.ts`
- Create: `src/main/ipc/agent-handlers.ts`
- Create: `src/main/ipc/file-handlers.ts`

- [ ] **Step 1: Implement ThreadManager**

Create `src/main/thread-manager.ts`:
```typescript
import { Database } from './db';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { createCodingAgent } from '@/coding/agents/create-agent';
import type { ModelProvider } from '@/foundation/models/provider';

export class ThreadManager {
  private agents: Map<string, Agent> = new Map();

  constructor(
    private db: Database,
    private providers: Map<string, ModelProvider>,
  ) {}

  async createThread(params: {
    title: string;
    projectPath: string;
    modelId: string;
    mode: 'local' | 'worktree';
  }): Promise<string> {
    const id = this.db.createThread(params);
    return id;
  }

  async getOrCreateAgent(threadId: string): Promise<Agent> {
    if (this.agents.has(threadId)) return this.agents.get(threadId)!;

    const thread = this.db.getThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    // Find provider for this model
    const provider = this.resolveProvider(thread.model_id);
    const model = new Model(thread.model_id, provider);
    const agent = await createCodingAgent({
      model,
      cwd: thread.project_path,
    });

    // Restore message history
    const savedMessages = this.db.getMessages(threadId);
    // TODO: restore messages into agent

    this.agents.set(threadId, agent);
    return agent;
  }

  abortAgent(threadId: string): void {
    this.agents.get(threadId)?.abort();
  }

  removeAgent(threadId: string): void {
    this.abortAgent(threadId);
    this.agents.delete(threadId);
  }

  private resolveProvider(modelId: string): ModelProvider {
    // Simple routing: claude-* → anthropic, others → openai
    if (modelId.startsWith('claude')) {
      return this.providers.get('anthropic')!;
    }
    return this.providers.get('openai')!;
  }
}
```

- [ ] **Step 2: Wire IPC handlers to ThreadManager**

Create `src/main/ipc/handlers.ts` — register all IPC handlers with the Electron `ipcMain`.

- [ ] **Step 3: Commit**

```bash
git add src/main/thread-manager.ts src/main/ipc/
git commit -m "feat(main): add ThreadManager + IPC handler wiring"
```

---

### Task 9.2: E2E — 线程生命周期

**Files:**
- Test: `tests/e2e/thread-lifecycle.test.ts`

- [ ] **Step 1: Write E2E test**

Create `tests/e2e/thread-lifecycle.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Thread Lifecycle', () => {
  test('create a new thread → appears in sidebar', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    await window.click('text=+ New thread');
    // Should show input for thread title or open dialog
    await expect(window.locator('.sidebar-item')).toHaveCount(1);

    await app.close();
  });

  test('switch between threads → chat panel updates', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Create two threads
    await window.click('text=+ New thread');
    await window.click('text=+ New thread');
    await expect(window.locator('.sidebar-item')).toHaveCount(2);

    // Click first thread
    await window.locator('.sidebar-item').first().click();
    // Verify chat panel shows correct thread

    await app.close();
  });

  test('delete a thread → removed from sidebar', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    await window.click('text=+ New thread');
    // Right click to delete
    await window.locator('.sidebar-item').first().click({ button: 'right' });
    await window.click('text=Delete');
    await expect(window.locator('.sidebar-item')).toHaveCount(0);

    await app.close();
  });
});
```

- [ ] **Step 2: Commit (tests pass after full wiring)**

```bash
git add tests/e2e/thread-lifecycle.test.ts
git commit -m "test(e2e): thread lifecycle — create, switch, delete"
```

---

### Task 9.3: E2E — Agent 对话流程

**Files:**
- Test: `tests/e2e/agent-chat.test.ts`

- [ ] **Step 1: Write E2E test**

Create `tests/e2e/agent-chat.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Agent Chat', () => {
  test('send message → see thinking + tool call + response', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Open a project
    // Note: in real test, mock the dialog or use env var for test project path

    // Create thread and type message
    await window.click('text=+ New thread');
    const input = window.locator('input[placeholder*="Ask anything"]');
    await input.fill('List all files in src/');
    await input.press('Enter');

    // Wait for response
    await expect(window.locator('.msg-tool')).toBeVisible({ timeout: 30000 });
    await expect(window.locator('.msg-assistant')).toBeVisible();

    await app.close();
  });

  test('abort agent during execution', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    await window.click('text=+ New thread');
    const input = window.locator('input[placeholder*="Ask anything"]');
    await input.fill('Run a slow command');
    await input.press('Enter');

    // Click abort button (should appear during streaming)
    await window.click('[data-testid="abort-btn"]');

    // Verify agent stopped
    await expect(window.locator('.streaming-indicator')).not.toBeVisible();

    await app.close();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/agent-chat.test.ts
git commit -m "test(e2e): agent chat — send message, see response, abort"
```

---

### Task 9.4: E2E — Preview Panel

**Files:**
- Test: `tests/e2e/preview-panel.test.ts`

- [ ] **Step 1: Write E2E test**

Create `tests/e2e/preview-panel.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Preview Panel', () => {
  test('shows code in Monaco after agent edits a file', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // After agent edits a file, preview should show the file
    // Click Code tab
    await window.click('text=Code');
    await expect(window.locator('[data-testid="monaco-view"]')).toBeVisible();

    await app.close();
  });

  test('shows Diff view with changes', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    await window.click('text=Diff');
    await expect(window.locator('[data-testid="diff-view"]')).toBeVisible();

    await app.close();
  });

  test('toggle preview panel visibility', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Cmd+\ to toggle
    await window.keyboard.press('Meta+\\');
    await expect(window.locator('.preview-panel')).not.toBeVisible();

    await window.keyboard.press('Meta+\\');
    await expect(window.locator('.preview-panel')).toBeVisible();

    await app.close();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/preview-panel.test.ts
git commit -m "test(e2e): preview panel — code, diff, toggle visibility"
```

---

### Task 9.5: E2E — 全流程场景：代码编辑

**Files:**
- Test: `tests/e2e/scenario-code-editing.test.ts`

- [ ] **Step 1: Write full scenario test**

Create `tests/e2e/scenario-code-editing.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Full Scenario: Code Editing', () => {
  test('open project → new thread → agent edits code → see diff → commit', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // 1. Open project (mock or test fixture)
    // 2. Create new thread
    await window.click('text=+ New thread');

    // 3. Send message to edit code
    const input = window.locator('input[placeholder*="Ask anything"]');
    await input.fill('Add a loading prop to the Button component');
    await input.press('Enter');

    // 4. Wait for agent to finish
    await expect(window.locator('.msg-assistant').last()).toContainText(/loading|done|complete/i, { timeout: 60000 });

    // 5. Verify diff view shows changes
    await window.click('text=Diff');
    await expect(window.locator('[data-testid="diff-view"]')).toBeVisible();

    // 6. Click commit
    await window.click('text=Commit');
    // Verify commit success feedback

    await app.close();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/scenario-code-editing.test.ts
git commit -m "test(e2e): full scenario — open project, agent edits, diff, commit"
```

---

### Task 9.6: E2E — 全流程场景：博客写作 + 图片生成

**Files:**
- Test: `tests/e2e/scenario-blog-writing.test.ts`

- [ ] **Step 1: Write full scenario test**

Create `tests/e2e/scenario-blog-writing.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Full Scenario: Blog Writing + Image Gen', () => {
  test('write blog → use Image Gen skill → preview markdown with image', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // 1. Create thread
    await window.click('text=+ New thread');

    // 2. Type @ to trigger skill picker, select Image Gen
    const input = window.locator('input[placeholder*="Ask anything"]');
    await input.fill('@');
    await window.click('text=Image Gen');

    // 3. Type message with skill tag
    await input.fill('Generate a hero image for my React hooks blog post');
    await input.press('Enter');

    // 4. Wait for agent response with image
    await expect(window.locator('.msg-tool').last()).toContainText(/generate_image/i, { timeout: 60000 });

    // 5. Verify preview shows markdown with embedded image
    await window.click('text=Markdown');
    await expect(window.locator('.markdown-view img, .image-view')).toBeVisible();

    await app.close();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/scenario-blog-writing.test.ts
git commit -m "test(e2e): full scenario — blog writing with Image Gen skill"
```

---

### Task 9.7: E2E — 模型/模式切换

**Files:**
- Test: `tests/e2e/scenario-model-mode.test.ts`

- [ ] **Step 1: Write test**

Create `tests/e2e/scenario-model-mode.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Model and Mode Switching', () => {
  test('switch model → next message uses new model', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Click model picker
    await window.click('text=Claude Sonnet 4');
    await window.click('text=GPT-4o');

    // Verify model changed in UI
    await expect(window.locator('.model-picker')).toContainText('GPT-4o');

    await app.close();
  });

  test('switch to Worktree mode → agent works in isolated branch', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Switch mode
    await window.click('text=Worktree');
    await expect(window.locator('.mode-btn.active')).toContainText('Worktree');

    await app.close();
  });

  test('keyboard shortcuts work', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();

    // Cmd+N → new thread
    await window.keyboard.press('Meta+n');
    await expect(window.locator('.sidebar-item')).toHaveCount(1);

    // Cmd+\ → toggle preview
    await window.keyboard.press('Meta+\\');
    await expect(window.locator('.preview-panel')).not.toBeVisible();

    await app.close();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/scenario-model-mode.test.ts
git commit -m "test(e2e): model switching, worktree mode, keyboard shortcuts"
```

---

## 更新后的覆盖统计

| 目标 | 测试类型 | 状态 |
|------|---------|------|
| Agent ReAct Loop | 单元 + 集成 | ✅ |
| 8 标准工具 | 单元 (8/8) | ✅ |
| 中间件系统 | 单元 | ✅ |
| 上下文压缩 | 单元 + 集成 | ✅ |
| Skills 系统 | 单元 + 集成 | ✅ |
| 自定义工具注册 | 集成 | ✅ |
| Git Worktree | 单元 | ✅ |
| OpenAI Provider | 单元 | ✅ |
| Anthropic Provider | 单元 | ✅ |
| SQLite 持久化 | 集成 | ✅ |
| 欢迎页 + 快捷卡片 | 组件 | ✅ |
| Sidebar 线程/Skills | 组件 | ✅ |
| 消息渲染 | 组件 | ✅ |
| 输入框 Skill 标签 | 组件 | ✅ |
| 模型选择器 | 组件 | ✅ |
| 模式切换 | 组件 | ✅ |
| Titlebar Open/Commit | 组件 | ✅ |
| Monaco 代码/Diff | 组件 | ✅ |
| Markdown 预览(含图片) | 组件 | ✅ |
| Image 预览 | 组件 | ✅ |
| PDF 预览 | 组件 | ✅ |
| CSV/JSON 预览 | 组件 | ✅ |
| App 启动 | E2E | ✅ |
| 线程生命周期 | E2E | ✅ |
| Agent 对话 | E2E | ✅ |
| Preview Panel | E2E | ✅ |
| 代码编辑全流程 | E2E | ✅ |
| 博客+图片生成全流程 | E2E | ✅ |
| 模型/模式切换 | E2E | ✅ |
| 键盘快捷键 | E2E | ✅ |
