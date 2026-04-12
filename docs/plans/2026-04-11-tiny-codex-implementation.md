# tiny-codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Electron-based Agent IDE that opens local projects and lets users interact with an AI agent to edit code, write articles, generate images, and preview multiple file formats.

**Architecture:** Single-process Electron app (Plan D). Agent framework has 4 layers: Foundation (types/interfaces) → Agent (ReAct loop + middleware + compaction) → Coding (8 tools + worktree) → App (Electron + React UI). Two model providers: OpenAI-compatible and Anthropic native. SQLite for persistence. Monaco Editor for code/diff. Preview panel for Markdown/HTML/CSV/JSON/Image/PDF/React Dev.

**Tech Stack:** Node.js, TypeScript, Electron 33, React 19, Vite, Vitest, Playwright, Monaco Editor, OpenAI SDK, Anthropic SDK, Zod 4, better-sqlite3, react-markdown, react-pdf, fast-glob, gray-matter

---

## Scope Note

This plan is organized into 9 phases. Each phase produces testable, commitable software. Phases 1-5 cover the **Agent framework** (can be tested standalone without Electron). Phases 6-9 cover the **Electron app, UI, and preview system**.

**TDD approach throughout:** Each task writes failing tests first, then implements the minimum code to pass.

**Testing stack:**
- `vitest` — unit & integration tests
- `@testing-library/react` — React component tests  
- `playwright` (Electron mode) — E2E tests

---

## File Structure

```
tiny-codex/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                     # Vite for renderer
├── vitest.config.ts                   # Test config
├── electron-builder.yml               # Electron packaging
├── playwright.config.ts               # E2E config
│
├── src/
│   ├── foundation/                    # Layer 1: Core primitives
│   │   ├── messages/
│   │   │   ├── types.ts               # Content & Message types
│   │   │   └── index.ts
│   │   ├── models/
│   │   │   ├── model.ts               # Model class
│   │   │   ├── provider.ts            # ModelProvider interface
│   │   │   ├── context.ts             # ModelContext type
│   │   │   └── index.ts
│   │   ├── tools/
│   │   │   ├── define-tool.ts         # defineTool() factory
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── agent/                         # Layer 2: Agent core
│   │   ├── agent.ts                   # Agent class (ReAct loop)
│   │   ├── middleware.ts              # AgentMiddleware interface
│   │   ├── compaction/
│   │   │   ├── compactor.ts           # Compaction engine
│   │   │   └── index.ts
│   │   ├── skills/
│   │   │   ├── skill-reader.ts        # SKILL.md parser
│   │   │   ├── skills-middleware.ts   # Skills middleware
│   │   │   ├── skill-tools.ts         # Custom tool registration
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── coding/                        # Layer 3: Coding domain
│   │   ├── agents/
│   │   │   ├── create-agent.ts        # Factory function
│   │   │   └── index.ts
│   │   ├── tools/
│   │   │   ├── bash.ts
│   │   │   ├── read-file.ts
│   │   │   ├── write-file.ts
│   │   │   ├── str-replace.ts
│   │   │   ├── glob.ts
│   │   │   ├── grep.ts
│   │   │   ├── list-dir.ts
│   │   │   ├── ask-user.ts
│   │   │   └── index.ts
│   │   ├── worktree/
│   │   │   ├── manager.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── community/                     # Layer 4: Provider adapters
│   │   ├── openai/
│   │   │   ├── provider.ts
│   │   │   ├── converter.ts
│   │   │   └── index.ts
│   │   └── anthropic/
│   │       ├── provider.ts
│   │       ├── converter.ts
│   │       └── index.ts
│   │
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # Entry point
│   │   ├── window.ts                  # Window management
│   │   ├── db.ts                      # SQLite database
│   │   ├── thread-manager.ts          # Thread lifecycle
│   │   ├── ipc/
│   │   │   ├── handlers.ts            # IPC handler registration
│   │   │   ├── thread-handlers.ts
│   │   │   ├── agent-handlers.ts
│   │   │   └── file-handlers.ts
│   │   └── preload.ts                 # contextBridge
│   │
│   ├── renderer/                      # React renderer process
│   │   ├── index.html
│   │   ├── main.tsx                   # React entry
│   │   ├── App.tsx
│   │   ├── stores/
│   │   │   ├── thread-store.ts        # Zustand store
│   │   │   └── ui-store.ts
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── ThreadList.tsx
│   │   │   │   └── SkillList.tsx
│   │   │   ├── ChatPanel/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── MessageHistory.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── ThinkingBlock.tsx
│   │   │   │   ├── ToolCallBlock.tsx
│   │   │   │   └── DiffBlock.tsx
│   │   │   ├── InputBox/
│   │   │   │   ├── InputBox.tsx
│   │   │   │   ├── SkillTagPicker.tsx
│   │   │   │   ├── ModelPicker.tsx
│   │   │   │   └── ModePicker.tsx
│   │   │   ├── PreviewPanel/
│   │   │   │   ├── PreviewPanel.tsx
│   │   │   │   ├── MonacoView.tsx
│   │   │   │   ├── DiffView.tsx
│   │   │   │   ├── MarkdownView.tsx
│   │   │   │   ├── ImageView.tsx
│   │   │   │   ├── PdfView.tsx
│   │   │   │   ├── CsvJsonView.tsx
│   │   │   │   └── HtmlView.tsx
│   │   │   ├── Titlebar/
│   │   │   │   └── Titlebar.tsx
│   │   │   └── Welcome/
│   │   │       ├── Welcome.tsx
│   │   │       └── QuickCards.tsx
│   │   └── hooks/
│   │       ├── useThread.ts
│   │       ├── useAgent.ts
│   │       └── usePreview.ts
│   │
│   └── shared/                        # Shared types (main ↔ renderer)
│       ├── ipc-channels.ts
│       └── types.ts
│
├── tests/
│   ├── unit/
│   │   ├── foundation/
│   │   │   ├── messages.test.ts
│   │   │   ├── model.test.ts
│   │   │   └── define-tool.test.ts
│   │   ├── agent/
│   │   │   ├── agent.test.ts
│   │   │   ├── middleware.test.ts
│   │   │   ├── compactor.test.ts
│   │   │   └── skills.test.ts
│   │   ├── coding/
│   │   │   ├── bash.test.ts
│   │   │   ├── read-file.test.ts
│   │   │   ├── write-file.test.ts
│   │   │   ├── str-replace.test.ts
│   │   │   ├── glob.test.ts
│   │   │   ├── grep.test.ts
│   │   │   ├── list-dir.test.ts
│   │   │   └── worktree.test.ts
│   │   └── community/
│   │       ├── openai-converter.test.ts
│   │       └── anthropic-converter.test.ts
│   ├── integration/
│   │   ├── agent-loop.test.ts         # Agent with mock provider
│   │   ├── agent-tools.test.ts        # Agent + real file tools
│   │   ├── compaction.test.ts         # Compaction with mock LLM
│   │   ├── thread-manager.test.ts     # ThreadManager + SQLite
│   │   └── skills-system.test.ts      # Skills loading + tool registration
│   ├── e2e/
│   │   ├── app-launch.test.ts         # Electron window opens
│   │   ├── thread-lifecycle.test.ts   # Create/switch/delete threads
│   │   ├── agent-chat.test.ts         # Send message → get response
│   │   └── preview-panel.test.ts      # Preview renders content
│   └── fixtures/
│       ├── mock-provider.ts           # MockModelProvider for testing
│       ├── sample-project/            # Fake project for file tool tests
│       │   ├── src/
│       │   │   └── Button.tsx
│       │   └── package.json
│       └── sample-skills/
│           └── test-skill/
│               └── SKILL.md
│
├── skills/                            # Built-in skills
│   ├── image-gen/
│   │   └── SKILL.md
│   └── tech-writer/
│       └── SKILL.md
│
└── docs/
    ├── design/
    └── plans/
```

---

## Phase 1: Project Scaffolding + Test Infrastructure

### Task 1.1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Initialize npm project**

```bash
cd /Users/bytedance/mdw/live-fe/biz/infra/AI/tiny-codex
npm init -y
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install electron react react-dom zod
npm install -D typescript @types/react @types/react-dom @types/node \
  vite @vitejs/plugin-react electron-builder \
  vitest @testing-library/react @testing-library/jest-dom jsdom \
  playwright @playwright/test
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git init
echo "node_modules/\ndist/\n.superpowers/" > .gitignore
git add package.json tsconfig.json tsconfig.node.json .gitignore
git commit -m "chore: initialize tiny-codex project"
```

---

### Task 1.2: Set up Vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/renderer/**', 'src/main/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Add test scripts to package.json**

Add to `scripts`:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 3: Create a smoke test to verify setup**

Create `tests/unit/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('test setup', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run smoke test**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/unit/smoke.test.ts package.json
git commit -m "chore: set up vitest test infrastructure"
```

---

### Task 1.3: Set up Playwright for Electron E2E

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/app-launch.test.ts`

- [ ] **Step 1: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
  },
});
```

- [ ] **Step 2: Write E2E skeleton — app launch**

Create `tests/e2e/app-launch.test.ts`:
```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('App Launch', () => {
  test('electron window opens with correct title', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();
    const title = await window.title();
    expect(title).toContain('tiny-codex');
    await app.close();
  });

  test('shows welcome screen when no project is open', async () => {
    const app = await electron.launch({ args: ['dist/main/index.js'] });
    const window = await app.firstWindow();
    await expect(window.locator('text=Let\'s build')).toBeVisible();
    await app.close();
  });
});
```

- [ ] **Step 3: Commit (tests will fail until Electron app is built in Phase 6)**

```bash
git add playwright.config.ts tests/e2e/app-launch.test.ts
git commit -m "chore: set up Playwright E2E test skeletons"
```

---

### Task 1.4: Create test fixtures

**Files:**
- Create: `tests/fixtures/mock-provider.ts`
- Create: `tests/fixtures/sample-project/src/Button.tsx`
- Create: `tests/fixtures/sample-project/package.json`
- Create: `tests/fixtures/sample-skills/test-skill/SKILL.md`

- [ ] **Step 1: Create MockModelProvider**

Create `tests/fixtures/mock-provider.ts`:
```typescript
import type { ModelProvider } from '@/foundation/models/provider';
import type { AssistantMessage } from '@/foundation/messages/types';

/**
 * MockModelProvider for testing Agent without real API calls.
 * Provide a sequence of responses; it returns them in order.
 */
export class MockModelProvider implements ModelProvider {
  private responses: AssistantMessage[];
  private callIndex = 0;
  public invocations: Array<{ model: string; messages: unknown[]; tools?: unknown[] }> = [];

  constructor(responses: AssistantMessage[]) {
    this.responses = responses;
  }

  async invoke(params: {
    model: string;
    messages: unknown[];
    tools?: unknown[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    this.invocations.push({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
    });
    if (this.callIndex >= this.responses.length) {
      throw new Error(`MockModelProvider: no more responses (called ${this.callIndex + 1} times, only ${this.responses.length} responses)`);
    }
    return this.responses[this.callIndex++];
  }
}
```

- [ ] **Step 2: Create sample project fixture**

Create `tests/fixtures/sample-project/package.json`:
```json
{
  "name": "sample-project",
  "version": "1.0.0"
}
```

Create `tests/fixtures/sample-project/src/Button.tsx`:
```tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

- [ ] **Step 3: Create sample skill fixture**

Create `tests/fixtures/sample-skills/test-skill/SKILL.md`:
```markdown
---
name: test-skill
description: A test skill for unit tests
tools:
  - name: echo
    description: Echoes the input
---

You are a test skill. Echo whatever the user says.
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/
git commit -m "chore: add test fixtures (mock provider, sample project, sample skill)"
```

---

## Phase 2: Foundation Layer (TDD)

### Task 2.1: Message types

**Files:**
- Create: `src/foundation/messages/types.ts`
- Create: `src/foundation/messages/index.ts`
- Test: `tests/unit/foundation/messages.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/foundation/messages.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  type TextContent,
  type ImageContent,
  type ThinkingContent,
  type ToolUseContent,
  type ToolResultContent,
  type SystemMessage,
  type UserMessage,
  type AssistantMessage,
  type ToolMessage,
  createTextContent,
  createUserMessage,
  createAssistantMessage,
  createToolMessage,
  extractToolUses,
} from '@/foundation/messages';

describe('Message Types', () => {
  describe('Content creation helpers', () => {
    it('creates TextContent', () => {
      const content = createTextContent('hello');
      expect(content).toEqual({ type: 'text', text: 'hello' });
    });
  });

  describe('Message creation helpers', () => {
    it('creates UserMessage with text', () => {
      const msg = createUserMessage('hello');
      expect(msg.role).toBe('user');
      expect(msg.content).toHaveLength(1);
      expect(msg.content[0]).toEqual({ type: 'text', text: 'hello' });
    });

    it('creates AssistantMessage with mixed content', () => {
      const msg = createAssistantMessage([
        { type: 'thinking', thinking: 'hmm...' },
        { type: 'text', text: 'here is my answer' },
        { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
      ]);
      expect(msg.role).toBe('assistant');
      expect(msg.content).toHaveLength(3);
    });

    it('creates ToolMessage', () => {
      const msg = createToolMessage('t1', 'file contents here');
      expect(msg.role).toBe('tool');
      expect(msg.content[0]).toEqual({
        type: 'tool_result',
        toolUseId: 't1',
        content: 'file contents here',
      });
    });
  });

  describe('extractToolUses', () => {
    it('extracts tool_use blocks from AssistantMessage', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'I will read the file' },
        { type: 'tool_use', id: 't1', name: 'read_file', input: { path: '/a.ts' } },
        { type: 'tool_use', id: 't2', name: 'bash', input: { command: 'ls' } },
      ]);
      const toolUses = extractToolUses(msg);
      expect(toolUses).toHaveLength(2);
      expect(toolUses[0].name).toBe('read_file');
      expect(toolUses[1].name).toBe('bash');
    });

    it('returns empty array when no tool_use', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'done' },
      ]);
      expect(extractToolUses(msg)).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/foundation/messages.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement message types**

Create `src/foundation/messages/types.ts`:
```typescript
// ===== Content Types =====

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type Content =
  | TextContent
  | ImageContent
  | ThinkingContent
  | ToolUseContent
  | ToolResultContent;

// ===== Message Types =====

export interface SystemMessage {
  role: 'system';
  content: TextContent[];
}

export interface UserMessage {
  role: 'user';
  content: (TextContent | ImageContent)[];
}

export interface AssistantMessage {
  role: 'assistant';
  content: (TextContent | ThinkingContent | ToolUseContent)[];
}

export interface ToolMessage {
  role: 'tool';
  content: ToolResultContent[];
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;
export type NonSystemMessage = UserMessage | AssistantMessage | ToolMessage;

// ===== Helpers =====

export function createTextContent(text: string): TextContent {
  return { type: 'text', text };
}

export function createUserMessage(text: string): UserMessage {
  return { role: 'user', content: [createTextContent(text)] };
}

export function createAssistantMessage(
  content: AssistantMessage['content'],
): AssistantMessage {
  return { role: 'assistant', content };
}

export function createToolMessage(
  toolUseId: string,
  result: string,
  isError = false,
): ToolMessage {
  return {
    role: 'tool',
    content: [{ type: 'tool_result', toolUseId, content: result, isError }],
  };
}

export function extractToolUses(msg: AssistantMessage): ToolUseContent[] {
  return msg.content.filter(
    (c): c is ToolUseContent => c.type === 'tool_use',
  );
}
```

Create `src/foundation/messages/index.ts`:
```typescript
export * from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/foundation/messages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/foundation/messages/ tests/unit/foundation/messages.test.ts
git commit -m "feat(foundation): add message types with creation helpers"
```

---

### Task 2.2: ModelProvider interface + Model class

**Files:**
- Create: `src/foundation/models/provider.ts`
- Create: `src/foundation/models/context.ts`
- Create: `src/foundation/models/model.ts`
- Create: `src/foundation/models/index.ts`
- Test: `tests/unit/foundation/model.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/foundation/model.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Model } from '@/foundation/models/model';
import type { ModelProvider } from '@/foundation/models/provider';
import type { AssistantMessage } from '@/foundation/messages/types';

describe('Model', () => {
  const mockResponse: AssistantMessage = {
    role: 'assistant',
    content: [{ type: 'text', text: 'hello' }],
  };

  function createMockProvider(): ModelProvider {
    return {
      invoke: vi.fn().mockResolvedValue(mockResponse),
    };
  }

  it('invokes provider with correct params', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider);

    const result = await model.invoke({
      prompt: 'You are helpful.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    expect(result).toEqual(mockResponse);
    expect(provider.invoke).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
      tools: undefined,
      options: undefined,
    });
  });

  it('passes model options to provider', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider, { temperature: 0, max_tokens: 4096 });

    await model.invoke({
      prompt: 'test',
      messages: [],
    });

    expect(provider.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { temperature: 0, max_tokens: 4096 },
      }),
    );
  });

  it('passes tools to provider', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider);
    const mockTools = [{ name: 'bash', description: 'run cmd', parameters: {}, invoke: vi.fn() }];

    await model.invoke({
      prompt: 'test',
      messages: [],
      tools: mockTools as any,
    });

    expect(provider.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ tools: mockTools }),
    );
  });

  it('omits system message when prompt is empty', async () => {
    const provider = createMockProvider();
    const model = new Model('gpt-4o', provider);

    await model.invoke({ prompt: '', messages: [] });

    const call = (provider.invoke as any).mock.calls[0][0];
    expect(call.messages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/foundation/model.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Model, Provider, Context**

Create `src/foundation/models/provider.ts`:
```typescript
import type { Message, AssistantMessage } from '../messages/types';
import type { FunctionTool } from '../tools/define-tool';

export interface ModelProvider {
  invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage>;
}
```

Create `src/foundation/models/context.ts`:
```typescript
import type { NonSystemMessage } from '../messages/types';
import type { FunctionTool } from '../tools/define-tool';

export interface ModelContext {
  prompt: string;
  messages: NonSystemMessage[];
  tools?: FunctionTool<any, any>[];
}
```

Create `src/foundation/models/model.ts`:
```typescript
import type { AssistantMessage, Message } from '../messages/types';
import type { ModelProvider } from './provider';
import type { ModelContext } from './context';

export class Model {
  constructor(
    readonly name: string,
    readonly provider: ModelProvider,
    readonly options?: Record<string, unknown>,
  ) {}

  async invoke(context: ModelContext): Promise<AssistantMessage> {
    const messages: Message[] = [];

    if (context.prompt) {
      messages.push({
        role: 'system',
        content: [{ type: 'text', text: context.prompt }],
      });
    }

    messages.push(...context.messages);

    return this.provider.invoke({
      model: this.name,
      messages,
      tools: context.tools,
      options: this.options,
    });
  }
}
```

Create `src/foundation/models/index.ts`:
```typescript
export { Model } from './model';
export type { ModelProvider } from './provider';
export type { ModelContext } from './context';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/foundation/model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/foundation/models/ tests/unit/foundation/model.test.ts
git commit -m "feat(foundation): add Model class and ModelProvider interface"
```

---

### Task 2.3: defineTool() factory

**Files:**
- Create: `src/foundation/tools/define-tool.ts`
- Create: `src/foundation/tools/index.ts`
- Create: `src/foundation/index.ts`
- Test: `tests/unit/foundation/define-tool.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/foundation/define-tool.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { defineTool } from '@/foundation/tools/define-tool';

describe('defineTool', () => {
  it('creates a tool with name, description, parameters, invoke', () => {
    const tool = defineTool({
      name: 'echo',
      description: 'Echoes input',
      parameters: z.object({
        message: z.string().describe('The message to echo'),
      }),
      invoke: async ({ message }) => message,
    });

    expect(tool.name).toBe('echo');
    expect(tool.description).toBe('Echoes input');
    expect(tool.parameters).toBeDefined();
  });

  it('invoke executes the function', async () => {
    const tool = defineTool({
      name: 'add',
      description: 'Adds two numbers',
      parameters: z.object({
        a: z.number(),
        b: z.number(),
      }),
      invoke: async ({ a, b }) => String(a + b),
    });

    const result = await tool.invoke({ a: 2, b: 3 });
    expect(result).toBe('5');
  });

  it('generates JSON Schema from Zod schema', () => {
    const tool = defineTool({
      name: 'test',
      description: 'test',
      parameters: z.object({
        path: z.string().describe('File path'),
        verbose: z.boolean().optional(),
      }),
      invoke: async () => '',
    });

    const schema = tool.toJSONSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.path).toBeDefined();
    expect(schema.properties.path.type).toBe('string');
    expect(schema.required).toContain('path');
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/foundation/define-tool.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement defineTool**

Create `src/foundation/tools/define-tool.ts`:
```typescript
import { type z } from 'zod';

export interface FunctionTool<P extends z.ZodSchema = z.ZodSchema, R = string> {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>) => Promise<R>;
  toJSONSchema: () => Record<string, unknown>;
}

export function defineTool<P extends z.ZodSchema, R = string>(config: {
  name: string;
  description: string;
  parameters: P;
  invoke: (input: z.infer<P>) => Promise<R>;
}): FunctionTool<P, R> {
  return {
    ...config,
    toJSONSchema() {
      // Zod v4 has toJSONSchema(), Zod v3 uses zodToJsonSchema
      if ('toJSONSchema' in config.parameters) {
        return (config.parameters as any).toJSONSchema();
      }
      // Fallback: use zod's built-in json schema generation
      throw new Error('Zod schema does not support toJSONSchema(). Use Zod v4+.');
    },
  };
}
```

Create `src/foundation/tools/index.ts`:
```typescript
export { defineTool } from './define-tool';
export type { FunctionTool } from './define-tool';
```

Create `src/foundation/index.ts`:
```typescript
export * from './messages';
export * from './models';
export * from './tools';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/foundation/define-tool.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/foundation/ tests/unit/foundation/define-tool.test.ts
git commit -m "feat(foundation): add defineTool() factory with Zod schema support"
```

---

## Phase 3: Community Layer — Providers (TDD)

### Task 3.1: OpenAI message converter

**Files:**
- Create: `src/community/openai/converter.ts`
- Test: `tests/unit/community/openai-converter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/community/openai-converter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  convertToOpenAIMessages,
  parseOpenAIResponse,
  convertToOpenAITools,
} from '@/community/openai/converter';
import { createUserMessage, createAssistantMessage, createToolMessage } from '@/foundation/messages';
import { defineTool } from '@/foundation/tools';
import { z } from 'zod';

describe('OpenAI Converter', () => {
  describe('convertToOpenAIMessages', () => {
    it('converts UserMessage to OpenAI format', () => {
      const msg = createUserMessage('hello');
      const result = convertToOpenAIMessages([msg]);
      expect(result).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('converts AssistantMessage with text only', () => {
      const msg = createAssistantMessage([{ type: 'text', text: 'hi' }]);
      const result = convertToOpenAIMessages([msg]);
      expect(result[0]).toEqual({ role: 'assistant', content: 'hi' });
    });

    it('converts AssistantMessage with tool_use to tool_calls', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'reading file' },
        { type: 'tool_use', id: 't1', name: 'read_file', input: { path: '/a.ts' } },
      ]);
      const result = convertToOpenAIMessages([msg]);
      expect(result[0].tool_calls).toHaveLength(1);
      expect(result[0].tool_calls[0]).toEqual({
        type: 'function',
        id: 't1',
        function: { name: 'read_file', arguments: '{"path":"/a.ts"}' },
      });
    });

    it('filters out thinking content', () => {
      const msg = createAssistantMessage([
        { type: 'thinking', thinking: 'let me think...' },
        { type: 'text', text: 'answer' },
      ]);
      const result = convertToOpenAIMessages([msg]);
      expect(result[0].content).toBe('answer');
    });

    it('converts ToolMessage to OpenAI tool response', () => {
      const msg = createToolMessage('t1', 'file contents');
      const result = convertToOpenAIMessages([msg]);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 't1',
        content: 'file contents',
      });
    });
  });

  describe('parseOpenAIResponse', () => {
    it('parses text-only response', () => {
      const response = {
        role: 'assistant' as const,
        content: 'hello',
        tool_calls: undefined,
      };
      const msg = parseOpenAIResponse(response);
      expect(msg.role).toBe('assistant');
      expect(msg.content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('parses response with tool_calls', () => {
      const response = {
        role: 'assistant' as const,
        content: 'I will read the file',
        tool_calls: [{
          type: 'function' as const,
          id: 't1',
          function: { name: 'read_file', arguments: '{"path":"/a.ts"}' },
        }],
      };
      const msg = parseOpenAIResponse(response);
      expect(msg.content).toHaveLength(2);
      expect(msg.content[1]).toEqual({
        type: 'tool_use',
        id: 't1',
        name: 'read_file',
        input: { path: '/a.ts' },
      });
    });

    it('parses reasoning_content as thinking (Doubao/DeepSeek)', () => {
      const response = {
        role: 'assistant' as const,
        content: 'answer',
        reasoning_content: 'let me reason about this...',
      };
      const msg = parseOpenAIResponse(response);
      expect(msg.content[0]).toEqual({
        type: 'thinking',
        thinking: 'let me reason about this...',
      });
      expect(msg.content[1]).toEqual({ type: 'text', text: 'answer' });
    });
  });

  describe('convertToOpenAITools', () => {
    it('converts FunctionTool array to OpenAI format', () => {
      const tool = defineTool({
        name: 'bash',
        description: 'Execute a command',
        parameters: z.object({ command: z.string() }),
        invoke: async () => '',
      });
      const result = convertToOpenAITools([tool]);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute a command',
          parameters: expect.objectContaining({ type: 'object' }),
        },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/community/openai-converter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement converter**

Create `src/community/openai/converter.ts`:
```typescript
import type { Message, AssistantMessage } from '@/foundation/messages/types';
import type { FunctionTool } from '@/foundation/tools/define-tool';

// ===== Internal → OpenAI =====

export function convertToOpenAIMessages(messages: Message[]): any[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'system':
        return { role: 'system', content: msg.content.map((c) => c.text).join('\n') };

      case 'user': {
        const textParts = msg.content.filter((c) => c.type === 'text');
        return { role: 'user', content: textParts.map((c) => c.text).join('\n') };
      }

      case 'assistant': {
        const textParts = msg.content.filter((c) => c.type === 'text');
        const toolUses = msg.content.filter((c) => c.type === 'tool_use');
        const result: any = {
          role: 'assistant',
          content: textParts.map((c) => c.text).join('\n') || null,
        };
        if (toolUses.length > 0) {
          result.tool_calls = toolUses.map((t) => ({
            type: 'function',
            id: t.id,
            function: {
              name: t.name,
              arguments: JSON.stringify(t.input),
            },
          }));
        }
        return result;
      }

      case 'tool': {
        const result = msg.content[0];
        return {
          role: 'tool',
          tool_call_id: result.toolUseId,
          content: result.content,
        };
      }
    }
  });
}

// ===== OpenAI → Internal =====

export function parseOpenAIResponse(response: {
  role: 'assistant';
  content?: string | null;
  tool_calls?: Array<{
    type: 'function';
    id: string;
    function: { name: string; arguments: string };
  }>;
  reasoning_content?: string;
}): AssistantMessage {
  const content: AssistantMessage['content'] = [];

  // reasoning_content → ThinkingContent (Doubao/DeepSeek specific)
  if (response.reasoning_content) {
    content.push({ type: 'thinking', thinking: response.reasoning_content });
  }

  // text content
  if (response.content) {
    content.push({ type: 'text', text: response.content });
  }

  // tool_calls → ToolUseContent
  if (response.tool_calls) {
    for (const tc of response.tool_calls) {
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      });
    }
  }

  return { role: 'assistant', content };
}

// ===== Tools → OpenAI =====

export function convertToOpenAITools(tools: FunctionTool<any, any>[]): any[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.toJSONSchema(),
    },
  }));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/community/openai-converter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/community/openai/converter.ts tests/unit/community/openai-converter.test.ts
git commit -m "feat(community): add OpenAI message/tool converter"
```

---

### Task 3.2: OpenAI ModelProvider

**Files:**
- Create: `src/community/openai/provider.ts`
- Create: `src/community/openai/index.ts`

- [ ] **Step 1: Implement OpenAIModelProvider**

Create `src/community/openai/provider.ts`:
```typescript
import OpenAI from 'openai';
import type { ModelProvider } from '@/foundation/models/provider';
import type { Message, AssistantMessage } from '@/foundation/messages/types';
import type { FunctionTool } from '@/foundation/tools/define-tool';
import { convertToOpenAIMessages, parseOpenAIResponse, convertToOpenAITools } from './converter';

export class OpenAIModelProvider implements ModelProvider {
  private client: OpenAI;

  constructor(config: { baseURL?: string; apiKey: string }) {
    this.client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
  }

  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    const requestParams: any = {
      model: params.model,
      messages: convertToOpenAIMessages(params.messages),
      ...params.options,
    };

    if (params.tools && params.tools.length > 0) {
      requestParams.tools = convertToOpenAITools(params.tools);
    }

    const response = await this.client.chat.completions.create(requestParams);
    return parseOpenAIResponse(response.choices[0].message as any);
  }
}
```

Create `src/community/openai/index.ts`:
```typescript
export { OpenAIModelProvider } from './provider';
export { convertToOpenAIMessages, parseOpenAIResponse, convertToOpenAITools } from './converter';
```

- [ ] **Step 2: Commit (provider itself is tested via integration tests with mock)**

```bash
git add src/community/openai/
git commit -m "feat(community): add OpenAIModelProvider"
```

---

### Task 3.3: Anthropic message converter + provider

**Files:**
- Create: `src/community/anthropic/converter.ts`
- Create: `src/community/anthropic/provider.ts`
- Create: `src/community/anthropic/index.ts`
- Test: `tests/unit/community/anthropic-converter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/community/anthropic-converter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  convertToAnthropicMessages,
  parseAnthropicResponse,
} from '@/community/anthropic/converter';
import { createUserMessage, createAssistantMessage, createToolMessage } from '@/foundation/messages';

describe('Anthropic Converter', () => {
  describe('convertToAnthropicMessages', () => {
    it('converts UserMessage — content blocks array', () => {
      const msg = createUserMessage('hello');
      const result = convertToAnthropicMessages([msg]);
      expect(result).toEqual([{
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
      }]);
    });

    it('converts AssistantMessage with tool_use', () => {
      const msg = createAssistantMessage([
        { type: 'text', text: 'reading' },
        { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
      ]);
      const result = convertToAnthropicMessages([msg]);
      expect(result[0].content).toEqual([
        { type: 'text', text: 'reading' },
        { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
      ]);
    });

    it('converts ToolMessage to tool_result content block', () => {
      const msg = createToolMessage('t1', 'output');
      const result = convertToAnthropicMessages([msg]);
      expect(result[0]).toEqual({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't1', content: 'output' }],
      });
    });
  });

  describe('parseAnthropicResponse', () => {
    it('parses text + tool_use blocks', () => {
      const response = {
        content: [
          { type: 'text', text: 'I will help' },
          { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
        ],
      };
      const msg = parseAnthropicResponse(response as any);
      expect(msg.role).toBe('assistant');
      expect(msg.content).toHaveLength(2);
      expect(msg.content[0]).toEqual({ type: 'text', text: 'I will help' });
      expect(msg.content[1]).toEqual({
        type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' },
      });
    });

    it('parses thinking blocks', () => {
      const response = {
        content: [
          { type: 'thinking', thinking: 'let me reason...' },
          { type: 'text', text: 'answer' },
        ],
      };
      const msg = parseAnthropicResponse(response as any);
      expect(msg.content[0]).toEqual({ type: 'thinking', thinking: 'let me reason...' });
    });
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/community/anthropic-converter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Anthropic converter + provider**

Create `src/community/anthropic/converter.ts`:
```typescript
import type { Message, AssistantMessage } from '@/foundation/messages/types';

export function convertToAnthropicMessages(messages: Message[]): any[] {
  return messages.flatMap((msg) => {
    switch (msg.role) {
      case 'system':
        return []; // System is passed separately in Anthropic API

      case 'user':
        return [{ role: 'user', content: msg.content }];

      case 'assistant':
        // Internal format aligns with Anthropic — pass through
        return [{ role: 'assistant', content: msg.content }];

      case 'tool':
        // Anthropic: tool results go in a user message
        return [{
          role: 'user',
          content: msg.content.map((c) => ({
            type: 'tool_result',
            tool_use_id: c.toolUseId,
            content: c.content,
            ...(c.isError ? { is_error: true } : {}),
          })),
        }];
    }
  });
}

export function extractSystemPrompt(messages: Message[]): string | undefined {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  if (systemMsgs.length === 0) return undefined;
  return systemMsgs
    .flatMap((m) => m.content)
    .map((c) => c.text)
    .join('\n');
}

export function parseAnthropicResponse(response: {
  content: Array<{
    type: string;
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
}): AssistantMessage {
  const content: AssistantMessage['content'] = response.content.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text' as const, text: block.text! };
      case 'thinking':
        return { type: 'thinking' as const, thinking: block.thinking! };
      case 'tool_use':
        return {
          type: 'tool_use' as const,
          id: block.id!,
          name: block.name!,
          input: block.input!,
        };
      default:
        return { type: 'text' as const, text: `[unknown block: ${block.type}]` };
    }
  });

  return { role: 'assistant', content };
}
```

Create `src/community/anthropic/provider.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ModelProvider } from '@/foundation/models/provider';
import type { Message, AssistantMessage } from '@/foundation/messages/types';
import type { FunctionTool } from '@/foundation/tools/define-tool';
import { convertToAnthropicMessages, extractSystemPrompt, parseAnthropicResponse } from './converter';

export class AnthropicModelProvider implements ModelProvider {
  private client: Anthropic;

  constructor(config: { apiKey: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async invoke(params: {
    model: string;
    messages: Message[];
    tools?: FunctionTool<any, any>[];
    options?: Record<string, unknown>;
  }): Promise<AssistantMessage> {
    const system = extractSystemPrompt(params.messages);
    const nonSystemMessages = params.messages.filter((m) => m.role !== 'system');

    const requestParams: any = {
      model: params.model,
      messages: convertToAnthropicMessages(nonSystemMessages),
      max_tokens: 8192,
      ...params.options,
    };

    if (system) {
      requestParams.system = system;
    }

    if (params.tools && params.tools.length > 0) {
      requestParams.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.toJSONSchema(),
      }));
    }

    const response = await this.client.messages.create(requestParams);
    return parseAnthropicResponse(response as any);
  }
}
```

Create `src/community/anthropic/index.ts`:
```typescript
export { AnthropicModelProvider } from './provider';
export { convertToAnthropicMessages, parseAnthropicResponse } from './converter';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/community/anthropic-converter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/community/ tests/unit/community/
git commit -m "feat(community): add Anthropic provider and converter"
```

---

## Phase 4: Agent Layer (TDD)

### Task 4.1: Agent class — ReAct loop core

**Files:**
- Create: `src/agent/agent.ts`
- Create: `src/agent/middleware.ts`
- Create: `src/agent/index.ts`
- Test: `tests/unit/agent/agent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/agent/agent.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../../fixtures/mock-provider';
import { z } from 'zod';
import type { AssistantMessage } from '@/foundation/messages/types';

describe('Agent', () => {
  function createTextResponse(text: string): AssistantMessage {
    return { role: 'assistant', content: [{ type: 'text', text }] };
  }

  function createToolCallResponse(toolName: string, input: Record<string, unknown>, text = ''): AssistantMessage {
    return {
      role: 'assistant',
      content: [
        ...(text ? [{ type: 'text' as const, text }] : []),
        { type: 'tool_use' as const, id: `call-${Date.now()}`, name: toolName, input },
      ],
    };
  }

  describe('stream()', () => {
    it('returns assistant message when no tool calls', async () => {
      const provider = new MockModelProvider([
        createTextResponse('Hello!'),
      ]);
      const model = new Model('test', provider);
      const agent = new Agent({ model, prompt: 'You are helpful.' });

      const messages = [];
      for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
    });

    it('executes tool and continues loop', async () => {
      const provider = new MockModelProvider([
        createToolCallResponse('echo', { message: 'hello' }),
        createTextResponse('Done! I echoed hello.'),
      ]);
      const model = new Model('test', provider);
      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo',
        parameters: z.object({ message: z.string() }),
        invoke: async ({ message }) => message,
      });
      const agent = new Agent({ model, prompt: 'test', tools: [echoTool] });

      const messages = [];
      for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'echo hello' }] })) {
        messages.push(msg);
      }

      // Should be: AssistantMsg (tool call) → ToolMsg (result) → AssistantMsg (final)
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('assistant');
      expect(messages[1].role).toBe('tool');
      expect(messages[2].role).toBe('assistant');
    });

    it('respects maxSteps limit', async () => {
      // Provider always returns tool calls — should stop at maxSteps
      const infiniteToolCalls = Array.from({ length: 10 }, () =>
        createToolCallResponse('echo', { message: 'loop' }),
      );
      const provider = new MockModelProvider(infiniteToolCalls);
      const model = new Model('test', provider);
      const echoTool = defineTool({
        name: 'echo',
        description: 'Echo',
        parameters: z.object({ message: z.string() }),
        invoke: async ({ message }) => message,
      });
      const agent = new Agent({ model, prompt: 'test', tools: [echoTool], maxSteps: 3 });

      const messages = [];
      await expect(async () => {
        for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'loop' }] })) {
          messages.push(msg);
        }
      }).rejects.toThrow(/max steps/i);
    });
  });

  describe('abort()', () => {
    it('stops the agent loop when aborted', async () => {
      const provider = new MockModelProvider([
        createToolCallResponse('slow', { ms: 5000 }),
        createTextResponse('should not reach'),
      ]);
      const model = new Model('test', provider);
      const slowTool = defineTool({
        name: 'slow',
        description: 'Slow tool',
        parameters: z.object({ ms: z.number() }),
        invoke: async ({ ms }) => {
          await new Promise((r) => setTimeout(r, ms));
          return 'done';
        },
      });
      const agent = new Agent({ model, prompt: 'test', tools: [slowTool] });

      const messages: any[] = [];
      const streamPromise = (async () => {
        for await (const msg of agent.stream({ role: 'user', content: [{ type: 'text', text: 'go' }] })) {
          messages.push(msg);
        }
      })();

      // Abort after a short delay
      setTimeout(() => agent.abort(), 50);

      await expect(streamPromise).rejects.toThrow(/abort/i);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/agent/agent.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Agent class**

Create `src/agent/middleware.ts`:
```typescript
import type { ModelContext } from '@/foundation/models/context';
import type { AssistantMessage, ToolUseContent } from '@/foundation/messages/types';

export interface AgentMiddleware {
  beforeAgentRun?(): Promise<Record<string, unknown> | void>;
  afterAgentRun?(): Promise<void>;
  beforeAgentStep?(step: number): Promise<void>;
  afterAgentStep?(step: number): Promise<void>;
  beforeModel?(context: ModelContext): Promise<Partial<ModelContext> | void>;
  afterModel?(message: AssistantMessage): Promise<AssistantMessage | void>;
  beforeToolUse?(toolUse: ToolUseContent): Promise<void>;
  afterToolUse?(toolUse: ToolUseContent, result: string): Promise<void>;
}
```

Create `src/agent/agent.ts`:
```typescript
import type { Model } from '@/foundation/models/model';
import type { ModelContext } from '@/foundation/models/context';
import type {
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolUseContent,
  NonSystemMessage,
} from '@/foundation/messages/types';
import type { FunctionTool } from '@/foundation/tools/define-tool';
import type { AgentMiddleware } from './middleware';
import { extractToolUses, createToolMessage } from '@/foundation/messages';

export interface AgentOptions {
  model: Model;
  prompt: string;
  messages?: NonSystemMessage[];
  tools?: FunctionTool<any, any>[];
  middlewares?: AgentMiddleware[];
  maxSteps?: number;
}

export class Agent {
  private model: Model;
  private prompt: string;
  private messages: NonSystemMessage[];
  private tools: FunctionTool<any, any>[];
  private middlewares: AgentMiddleware[];
  private maxSteps: number;
  private abortController: AbortController;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.prompt = options.prompt;
    this.messages = options.messages ? [...options.messages] : [];
    this.tools = options.tools ?? [];
    this.middlewares = options.middlewares ?? [];
    this.maxSteps = options.maxSteps ?? 100;
    this.abortController = new AbortController();
  }

  async *stream(message: UserMessage): AsyncGenerator<AssistantMessage | ToolMessage> {
    this.abortController = new AbortController();
    this.messages.push(message);

    // beforeAgentRun
    for (const mw of this.middlewares) {
      if (mw.beforeAgentRun) {
        const result = await mw.beforeAgentRun();
        if (result) Object.assign(this, result);
      }
    }

    for (let step = 1; step <= this.maxSteps; step++) {
      this.checkAborted();

      // beforeAgentStep
      for (const mw of this.middlewares) {
        if (mw.beforeAgentStep) await mw.beforeAgentStep(step);
      }

      // think
      const assistantMessage = await this.think();

      // afterModel
      let finalMessage = assistantMessage;
      for (const mw of this.middlewares) {
        if (mw.afterModel) {
          const modified = await mw.afterModel(finalMessage);
          if (modified) finalMessage = modified;
        }
      }

      this.messages.push(finalMessage);
      yield finalMessage;

      // extract tool uses
      const toolUses = extractToolUses(finalMessage);
      if (toolUses.length === 0) {
        // No tool calls — agent is done
        for (const mw of this.middlewares) {
          if (mw.afterAgentRun) await mw.afterAgentRun();
        }
        return;
      }

      // act — execute tools in parallel, yield results as they complete
      yield* this.act(toolUses);

      // afterAgentStep
      for (const mw of this.middlewares) {
        if (mw.afterAgentStep) await mw.afterAgentStep(step);
      }
    }

    throw new Error(`Agent exceeded max steps (${this.maxSteps})`);
  }

  abort(): void {
    this.abortController.abort();
  }

  getMessages(): NonSystemMessage[] {
    return [...this.messages];
  }

  private async think(): Promise<AssistantMessage> {
    let context: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools.length > 0 ? this.tools : undefined,
    };

    // beforeModel
    for (const mw of this.middlewares) {
      if (mw.beforeModel) {
        const patch = await mw.beforeModel(context);
        if (patch) context = { ...context, ...patch };
      }
    }

    return this.model.invoke(context);
  }

  private async *act(toolUses: ToolUseContent[]): AsyncGenerator<ToolMessage> {
    // Execute all tools in parallel, yield results as they complete (Promise.race)
    const pending = toolUses.map(async (toolUse, index) => {
      const tool = this.tools.find((t) => t.name === toolUse.name);

      // beforeToolUse
      for (const mw of this.middlewares) {
        if (mw.beforeToolUse) await mw.beforeToolUse(toolUse);
      }

      let resultText: string;
      if (!tool) {
        resultText = `Error: Unknown tool "${toolUse.name}"`;
      } else {
        try {
          this.checkAborted();
          const result = await tool.invoke(toolUse.input);
          resultText = typeof result === 'string' ? result : JSON.stringify(result);
        } catch (err: any) {
          if (err.name === 'AbortError' || this.abortController.signal.aborted) {
            throw new Error('Agent aborted');
          }
          resultText = `Error: ${err.message}`;
        }
      }

      // afterToolUse
      for (const mw of this.middlewares) {
        if (mw.afterToolUse) await mw.afterToolUse(toolUse, resultText);
      }

      return { index, toolUseId: toolUse.id, result: resultText };
    });

    // Promise.race pattern: yield results as they complete
    const remaining = new Set(pending.map((_, i) => i));
    while (remaining.size > 0) {
      const resolved = await Promise.race(
        [...remaining].map((i) => pending[i].then((r) => ({ ...r, pendingIndex: i }))),
      );
      remaining.delete(resolved.pendingIndex);

      const toolMessage = createToolMessage(resolved.toolUseId, resolved.result);
      this.messages.push(toolMessage);
      yield toolMessage;
    }
  }

  private checkAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new Error('Agent aborted');
    }
  }
}
```

Create `src/agent/index.ts`:
```typescript
export { Agent } from './agent';
export type { AgentOptions } from './agent';
export type { AgentMiddleware } from './middleware';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/agent/agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/ tests/unit/agent/agent.test.ts
git commit -m "feat(agent): implement ReAct loop with stream(), tool execution, abort"
```

---

### Task 4.2: Agent middleware system

**Files:**
- Test: `tests/unit/agent/middleware.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/agent/middleware.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../../fixtures/mock-provider';
import type { AgentMiddleware } from '@/agent/middleware';
import { z } from 'zod';

describe('Agent Middleware', () => {
  const textResponse = { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'done' }] };

  it('calls lifecycle hooks in order', async () => {
    const order: string[] = [];
    const middleware: AgentMiddleware = {
      beforeAgentRun: async () => { order.push('beforeAgentRun'); },
      afterAgentRun: async () => { order.push('afterAgentRun'); },
      beforeAgentStep: async () => { order.push('beforeAgentStep'); },
      afterAgentStep: async () => { order.push('afterAgentStep'); },
      beforeModel: async () => { order.push('beforeModel'); },
      afterModel: async () => { order.push('afterModel'); },
    };

    const provider = new MockModelProvider([textResponse]);
    const model = new Model('test', provider);
    const agent = new Agent({ model, prompt: 'test', middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {
      // consume
    }

    expect(order).toEqual([
      'beforeAgentRun',
      'beforeAgentStep',
      'beforeModel',
      'afterModel',
      // no afterAgentStep because loop ends (no tool calls)
      'afterAgentRun',
    ]);
  });

  it('beforeModel can modify prompt', async () => {
    const middleware: AgentMiddleware = {
      beforeModel: async (context) => {
        return { prompt: context.prompt + '\nExtra instruction' };
      },
    };

    const provider = new MockModelProvider([textResponse]);
    const model = new Model('test', provider);
    const agent = new Agent({ model, prompt: 'base', middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'hi' }] })) {}

    // Check that provider received modified prompt
    const call = provider.invocations[0];
    const systemMsg = call.messages[0] as any;
    expect(systemMsg.content[0].text).toContain('Extra instruction');
  });

  it('beforeToolUse and afterToolUse are called', async () => {
    const calls: string[] = [];
    const middleware: AgentMiddleware = {
      beforeToolUse: async (toolUse) => { calls.push(`before:${toolUse.name}`); },
      afterToolUse: async (toolUse, result) => { calls.push(`after:${toolUse.name}:${result}`); },
    };

    const provider = new MockModelProvider([
      { role: 'assistant', content: [
        { type: 'tool_use', id: 't1', name: 'echo', input: { message: 'hi' } },
      ]},
      textResponse,
    ]);
    const model = new Model('test', provider);
    const echoTool = defineTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ message: z.string() }),
      invoke: async ({ message }) => message,
    });
    const agent = new Agent({ model, prompt: 'test', tools: [echoTool], middlewares: [middleware] });

    for await (const _ of agent.stream({ role: 'user', content: [{ type: 'text', text: 'go' }] })) {}

    expect(calls).toEqual(['before:echo', 'after:echo:hi']);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/agent/middleware.test.ts`
Expected: PASS (middleware is already implemented in Agent class)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/agent/middleware.test.ts
git commit -m "test(agent): add middleware lifecycle hook tests"
```

---

### Task 4.3: Compaction engine

**Files:**
- Create: `src/agent/compaction/compactor.ts`
- Create: `src/agent/compaction/index.ts`
- Test: `tests/unit/agent/compactor.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/agent/compactor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Compactor } from '@/agent/compaction/compactor';
import { createUserMessage, createAssistantMessage, createToolMessage } from '@/foundation/messages';
import type { NonSystemMessage } from '@/foundation/messages/types';

describe('Compactor', () => {
  describe('shouldCompact', () => {
    it('returns false when messages are short', () => {
      const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });
      const messages: NonSystemMessage[] = [
        createUserMessage('hello'),
        createAssistantMessage([{ type: 'text', text: 'hi' }]),
      ];
      expect(compactor.shouldCompact(messages)).toBe(false);
    });

    it('returns true when estimated tokens exceed threshold', () => {
      const compactor = new Compactor({ contextWindow: 100, maxOutputTokens: 20, bufferTokens: 10 });
      // threshold = 100 - 20 - 10 = 70 tokens
      // Each char is roughly 0.25 tokens, so 280+ chars should trigger
      const longText = 'a'.repeat(300);
      const messages: NonSystemMessage[] = [
        createUserMessage(longText),
      ];
      expect(compactor.shouldCompact(messages)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('estimates tokens from message content', () => {
      const compactor = new Compactor({ contextWindow: 100000, maxOutputTokens: 4096 });
      const messages: NonSystemMessage[] = [
        createUserMessage('hello world'),
      ];
      const estimate = compactor.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(100);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/agent/compactor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Compactor**

Create `src/agent/compaction/compactor.ts`:
```typescript
import type { NonSystemMessage, AssistantMessage } from '@/foundation/messages/types';
import type { Model } from '@/foundation/models/model';
import { createUserMessage } from '@/foundation/messages';

export interface CompactorOptions {
  contextWindow: number;
  maxOutputTokens: number;
  bufferTokens?: number;
}

export class Compactor {
  private contextWindow: number;
  private maxOutputTokens: number;
  private bufferTokens: number;

  constructor(options: CompactorOptions) {
    this.contextWindow = options.contextWindow;
    this.maxOutputTokens = options.maxOutputTokens;
    this.bufferTokens = options.bufferTokens ?? 13000;
  }

  shouldCompact(messages: NonSystemMessage[]): boolean {
    const threshold = this.contextWindow - this.maxOutputTokens - this.bufferTokens;
    return this.estimateTokens(messages) > threshold;
  }

  estimateTokens(messages: NonSystemMessage[]): number {
    // Rough estimate: ~4 chars per token for English, ~2 chars for CJK
    let totalChars = 0;
    for (const msg of messages) {
      for (const content of msg.content) {
        if ('text' in content) totalChars += content.text.length;
        if ('thinking' in content) totalChars += content.thinking.length;
        if ('content' in content && typeof content.content === 'string') {
          totalChars += content.content.length;
        }
        if ('input' in content) totalChars += JSON.stringify(content.input).length;
      }
    }
    return Math.ceil(totalChars / 4);
  }

  async compact(
    messages: NonSystemMessage[],
    model: Model,
  ): Promise<NonSystemMessage[]> {
    // Generate summary using the model
    const summaryPrompt = `Summarize the following conversation concisely, preserving key decisions, file paths, and code changes. Output only the summary.`;

    const conversationText = messages
      .map((m) => {
        const role = m.role;
        const text = m.content
          .map((c) => {
            if ('text' in c) return c.text;
            if ('thinking' in c) return `[thinking] ${c.thinking}`;
            if ('content' in c && typeof c.content === 'string') return `[tool result] ${c.content}`;
            if ('name' in c) return `[tool call: ${c.name}]`;
            return '';
          })
          .join('\n');
        return `${role}: ${text}`;
      })
      .join('\n---\n');

    const summaryResponse = await model.invoke({
      prompt: summaryPrompt,
      messages: [createUserMessage(conversationText)],
    });

    const summaryText = summaryResponse.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    // Return a single compact boundary message
    return [
      createUserMessage(`[Previous conversation summary]\n${summaryText}`),
    ];
  }
}
```

Create `src/agent/compaction/index.ts`:
```typescript
export { Compactor } from './compactor';
export type { CompactorOptions } from './compactor';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/agent/compactor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/compaction/ tests/unit/agent/compactor.test.ts
git commit -m "feat(agent): add compaction engine with token estimation"
```

---

### Task 4.4: Skills system

**Files:**
- Create: `src/agent/skills/skill-reader.ts`
- Create: `src/agent/skills/skills-middleware.ts`
- Create: `src/agent/skills/skill-tools.ts`
- Create: `src/agent/skills/index.ts`
- Test: `tests/unit/agent/skills.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/agent/skills.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readSkillFrontMatter } from '@/agent/skills/skill-reader';
import path from 'path';

describe('Skills System', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-skills');

  describe('readSkillFrontMatter', () => {
    it('parses SKILL.md frontmatter', async () => {
      const skillPath = path.join(fixturesDir, 'test-skill/SKILL.md');
      const result = await readSkillFrontMatter(skillPath);
      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A test skill for unit tests');
    });

    it('returns null for non-existent file', async () => {
      const result = await readSkillFrontMatter('/nonexistent/SKILL.md');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/agent/skills.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement skill reader**

Create `src/agent/skills/skill-reader.ts`:
```typescript
import matter from 'gray-matter';
import { readFile } from 'fs/promises';

export interface SkillFrontmatter {
  name: string;
  description: string;
  tools?: Array<{ name: string; description: string }>;
}

export async function readSkillFrontMatter(filePath: string): Promise<SkillFrontmatter | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const { data } = matter(content);
    return {
      name: data.name ?? 'unknown',
      description: data.description ?? '',
      tools: data.tools,
    };
  } catch {
    return null;
  }
}
```

Create `src/agent/skills/skills-middleware.ts`:
```typescript
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { AgentMiddleware } from '../middleware';
import { readSkillFrontMatter, type SkillFrontmatter } from './skill-reader';

export function createSkillsMiddleware(skillsDirs: string[]): AgentMiddleware {
  let skills: SkillFrontmatter[] = [];

  return {
    async beforeAgentRun() {
      skills = [];
      for (const dir of skillsDirs) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillPath = join(dir, entry.name, 'SKILL.md');
            const frontmatter = await readSkillFrontMatter(skillPath);
            if (frontmatter) skills.push(frontmatter);
          }
        } catch {
          // Directory doesn't exist — skip
        }
      }
    },

    async beforeModel(context) {
      if (skills.length === 0) return;
      const skillList = JSON.stringify(skills.map((s) => ({ name: s.name, description: s.description })));
      return {
        prompt: context.prompt + `\n<skills>${skillList}</skills>`,
      };
    },
  };
}
```

Create `src/agent/skills/skill-tools.ts`:
```typescript
import type { FunctionTool } from '@/foundation/tools/define-tool';

/**
 * Registry for Skill-defined custom tools.
 * Skills can register additional tools beyond the 8 standard ones.
 */
export class SkillToolRegistry {
  private tools: Map<string, FunctionTool<any, any>> = new Map();

  register(tool: FunctionTool<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getAll(): FunctionTool<any, any>[] {
    return [...this.tools.values()];
  }

  get(name: string): FunctionTool<any, any> | undefined {
    return this.tools.get(name);
  }
}
```

Create `src/agent/skills/index.ts`:
```typescript
export { readSkillFrontMatter } from './skill-reader';
export type { SkillFrontmatter } from './skill-reader';
export { createSkillsMiddleware } from './skills-middleware';
export { SkillToolRegistry } from './skill-tools';
```

Update `src/agent/index.ts`:
```typescript
export { Agent } from './agent';
export type { AgentOptions } from './agent';
export type { AgentMiddleware } from './middleware';
export { Compactor } from './compaction';
export { readSkillFrontMatter, createSkillsMiddleware, SkillToolRegistry } from './skills';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/agent/skills.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/ tests/unit/agent/skills.test.ts
git commit -m "feat(agent): add skills system (reader, middleware, tool registry)"
```

---

### Task 4.5: Integration test — Agent loop with mock provider

**Files:**
- Test: `tests/integration/agent-loop.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/agent-loop.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { defineTool } from '@/foundation/tools';
import { MockModelProvider } from '../fixtures/mock-provider';
import { createUserMessage } from '@/foundation/messages';
import { z } from 'zod';

describe('Agent Loop Integration', () => {
  it('complete flow: user asks → agent reads file → agent responds', async () => {
    const provider = new MockModelProvider([
      // Step 1: Agent decides to read a file
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'I need to check the file first' },
          { type: 'tool_use', id: 'c1', name: 'read_file', input: { path: 'test.txt' } },
        ],
      },
      // Step 2: Agent responds with the answer
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The file contains: hello world' }],
      },
    ]);

    const model = new Model('test-model', provider);
    const readFileTool = defineTool({
      name: 'read_file',
      description: 'Read a file',
      parameters: z.object({ path: z.string() }),
      invoke: async () => 'hello world',
    });

    const agent = new Agent({
      model,
      prompt: 'You are a coding assistant.',
      tools: [readFileTool],
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('What is in test.txt?'))) {
      messages.push(msg);
    }

    // Verify the full message sequence
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('assistant'); // thinking + tool_use
    expect(messages[1].role).toBe('tool');      // tool result
    expect(messages[2].role).toBe('assistant'); // final answer

    // Verify tool result
    expect(messages[1].content[0].content).toBe('hello world');

    // Verify provider was called twice
    expect(provider.invocations).toHaveLength(2);

    // Verify conversation history is maintained
    const allMessages = agent.getMessages();
    expect(allMessages).toHaveLength(4); // user + assistant + tool + assistant
  });

  it('agent handles tool errors gracefully', async () => {
    const provider = new MockModelProvider([
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'c1', name: 'bash', input: { command: 'bad-cmd' } },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The command failed. Let me try another way.' }],
      },
    ]);

    const model = new Model('test', provider);
    const bashTool = defineTool({
      name: 'bash',
      description: 'Run command',
      parameters: z.object({ command: z.string() }),
      invoke: async () => { throw new Error('command not found'); },
    });

    const agent = new Agent({ model, prompt: 'test', tools: [bashTool] });
    const messages = [];
    for await (const msg of agent.stream(createUserMessage('run bad-cmd'))) {
      messages.push(msg);
    }

    // Tool error is captured, agent continues
    expect(messages).toHaveLength(3);
    expect(messages[1].content[0].content).toContain('Error: command not found');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration/agent-loop.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-loop.test.ts
git commit -m "test(integration): agent loop with mock provider — full flow + error handling"
```

---

## Phase 5: Coding Layer — Tools (TDD)

### Task 5.1: File tools (read_file, write_file, str_replace)

**Files:**
- Create: `src/coding/tools/read-file.ts`
- Create: `src/coding/tools/write-file.ts`
- Create: `src/coding/tools/str-replace.ts`
- Test: `tests/unit/coding/read-file.test.ts`
- Test: `tests/unit/coding/write-file.test.ts`
- Test: `tests/unit/coding/str-replace.test.ts`

- [ ] **Step 1: Write failing tests for read_file**

Create `tests/unit/coding/read-file.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileTool } from '@/coding/tools/read-file';
import path from 'path';

describe('read_file tool', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-project');

  it('reads an existing file', async () => {
    const result = await readFileTool.invoke({
      path: path.join(fixturesDir, 'src/Button.tsx'),
    });
    expect(result).toContain('ButtonProps');
    expect(result).toContain('export function Button');
  });

  it('returns error for non-existent file', async () => {
    const result = await readFileTool.invoke({
      path: path.join(fixturesDir, 'nonexistent.ts'),
    });
    expect(result).toContain('Error');
  });
});
```

- [ ] **Step 2: Write failing tests for write_file**

Create `tests/unit/coding/write-file.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileTool } from '@/coding/tools/write-file';
import { readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('write_file tool', () => {
  const tmpDir = path.join(os.tmpdir(), 'tiny-codex-test');
  const tmpFile = path.join(tmpDir, 'test-output.ts');

  afterEach(async () => {
    try { await unlink(tmpFile); } catch {}
  });

  it('writes content to a new file', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFileTool.invoke({
      path: tmpFile,
      content: 'export const x = 1;',
    });
    const content = await readFile(tmpFile, 'utf-8');
    expect(content).toBe('export const x = 1;');
  });
});
```

- [ ] **Step 3: Write failing tests for str_replace**

Create `tests/unit/coding/str-replace.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { strReplaceTool } from '@/coding/tools/str-replace';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('str_replace tool', () => {
  const tmpDir = path.join(os.tmpdir(), 'tiny-codex-test');
  const tmpFile = path.join(tmpDir, 'replace-test.ts');

  afterEach(async () => {
    try { await unlink(tmpFile); } catch {}
  });

  it('replaces a unique string in a file', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpFile, 'const x = 1;\nconst y = 2;\n');

    await strReplaceTool.invoke({
      path: tmpFile,
      old_string: 'const x = 1;',
      new_string: 'const x = 42;',
    });

    const content = await readFile(tmpFile, 'utf-8');
    expect(content).toBe('const x = 42;\nconst y = 2;\n');
  });

  it('returns error when old_string not found', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpFile, 'hello world');

    const result = await strReplaceTool.invoke({
      path: tmpFile,
      old_string: 'nonexistent',
      new_string: 'replacement',
    });

    expect(result).toContain('not found');
  });
});
```

- [ ] **Step 4: Run all three — verify fail**

Run: `npx vitest run tests/unit/coding/`
Expected: FAIL

- [ ] **Step 5: Implement all three tools**

Create `src/coding/tools/read-file.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { readFile } from 'fs/promises';
import { z } from 'zod';

export const readFileTool = defineTool({
  name: 'read_file',
  description: 'Read a file from the filesystem. Returns file contents as text.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
  }),
  invoke: async ({ path: filePath }) => {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  },
});
```

Create `src/coding/tools/write-file.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { z } from 'zod';

export const writeFileTool = defineTool({
  name: 'write_file',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  invoke: async ({ path: filePath, content }) => {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
      return `File written: ${filePath}`;
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  },
});
```

Create `src/coding/tools/str-replace.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';

export const strReplaceTool = defineTool({
  name: 'str_replace',
  description: 'Replace a string in a file. The old_string must be unique in the file.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    old_string: z.string().describe('The exact string to replace'),
    new_string: z.string().describe('The replacement string'),
  }),
  invoke: async ({ path: filePath, old_string, new_string }) => {
    try {
      const content = await readFile(filePath, 'utf-8');
      if (!content.includes(old_string)) {
        return `Error: old_string not found in ${filePath}`;
      }
      const occurrences = content.split(old_string).length - 1;
      if (occurrences > 1) {
        return `Error: old_string found ${occurrences} times in ${filePath}. Must be unique.`;
      }
      const newContent = content.replace(old_string, new_string);
      await writeFile(filePath, newContent, 'utf-8');
      return `Replaced in ${filePath}`;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/unit/coding/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/coding/tools/read-file.ts src/coding/tools/write-file.ts src/coding/tools/str-replace.ts tests/unit/coding/
git commit -m "feat(coding): add file tools — read_file, write_file, str_replace"
```

---

### Task 5.2: bash tool

**Files:**
- Create: `src/coding/tools/bash.ts`
- Test: `tests/unit/coding/bash.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/coding/bash.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { bashTool } from '@/coding/tools/bash';

describe('bash tool', () => {
  it('executes a simple command and returns stdout', async () => {
    const result = await bashTool.invoke({ command: 'echo hello' });
    expect(result.trim()).toBe('hello');
  });

  it('returns stderr on command failure', async () => {
    const result = await bashTool.invoke({ command: 'ls /nonexistent-path-xyz' });
    expect(result).toContain('No such file');
  });

  it('handles command timeout', async () => {
    const result = await bashTool.invoke({ command: 'sleep 0.1 && echo done' });
    expect(result.trim()).toBe('done');
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/coding/bash.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement bash tool**

Create `src/coding/tools/bash.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { spawn } from 'child_process';
import { z } from 'zod';

export const bashTool = defineTool({
  name: 'bash',
  description: 'Execute a bash command in the shell. Returns stdout or stderr.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
  invoke: async ({ command }) => {
    return new Promise<string>((resolve) => {
      const proc = spawn(process.env.SHELL ?? 'bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30 * 60 * 1000, // 30 minutes
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          resolve(stderr || `Command exited with code ${code}`);
        }
      });

      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  },
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/coding/bash.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/coding/tools/bash.ts tests/unit/coding/bash.test.ts
git commit -m "feat(coding): add bash tool with child_process.spawn"
```

---

### Task 5.3: Search tools (glob, grep, list_dir)

**Files:**
- Create: `src/coding/tools/glob.ts`
- Create: `src/coding/tools/grep.ts`
- Create: `src/coding/tools/list-dir.ts`
- Test: `tests/unit/coding/glob.test.ts`
- Test: `tests/unit/coding/list-dir.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/coding/glob.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { globTool } from '@/coding/tools/glob';
import path from 'path';

describe('glob tool', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-project');

  it('finds files matching a glob pattern', async () => {
    const result = await globTool.invoke({
      pattern: '**/*.tsx',
      cwd: fixturesDir,
    });
    expect(result).toContain('Button.tsx');
  });

  it('returns empty when no matches', async () => {
    const result = await globTool.invoke({
      pattern: '**/*.py',
      cwd: fixturesDir,
    });
    expect(result).toBe('No matches found.');
  });
});
```

Create `tests/unit/coding/list-dir.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { listDirTool } from '@/coding/tools/list-dir';
import path from 'path';

describe('list_dir tool', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/sample-project');

  it('lists directory contents', async () => {
    const result = await listDirTool.invoke({ path: fixturesDir });
    expect(result).toContain('src');
    expect(result).toContain('package.json');
  });

  it('returns error for non-existent directory', async () => {
    const result = await listDirTool.invoke({ path: '/nonexistent' });
    expect(result).toContain('Error');
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run tests/unit/coding/glob.test.ts tests/unit/coding/list-dir.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement glob, grep, list_dir**

Create `src/coding/tools/glob.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import fg from 'fast-glob';
import { z } from 'zod';

export const globTool = defineTool({
  name: 'glob',
  description: 'Search for files matching a glob pattern.',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern (e.g., "**/*.tsx")'),
    cwd: z.string().describe('Directory to search in'),
  }),
  invoke: async ({ pattern, cwd }) => {
    try {
      const files = await fg(pattern, { cwd, dot: false });
      if (files.length === 0) return 'No matches found.';
      return files.join('\n');
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
```

Create `src/coding/tools/grep.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { spawn } from 'child_process';
import { z } from 'zod';

export const grepTool = defineTool({
  name: 'grep',
  description: 'Search file contents for a regex pattern using ripgrep.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().describe('File or directory to search'),
    glob: z.string().optional().describe('File glob filter (e.g., "*.ts")'),
  }),
  invoke: async ({ pattern, path: searchPath, glob: globFilter }) => {
    return new Promise<string>((resolve) => {
      const args = ['--no-heading', '-n', pattern, searchPath];
      if (globFilter) args.push('--glob', globFilter);

      const proc = spawn('rg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('close', () => {
        resolve(output.trim() || 'No matches found.');
      });
      proc.on('error', () => {
        resolve(`Error: ripgrep (rg) not found. Install with: brew install ripgrep`);
      });
    });
  },
});
```

Create `src/coding/tools/list-dir.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

export const listDirTool = defineTool({
  name: 'list_dir',
  description: 'List contents of a directory.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the directory'),
  }),
  invoke: async ({ path: dirPath }) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((e) => {
        const prefix = e.isDirectory() ? '[dir]  ' : '[file] ';
        return prefix + e.name;
      });
      return lines.join('\n');
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/coding/glob.test.ts tests/unit/coding/list-dir.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/coding/tools/glob.ts src/coding/tools/grep.ts src/coding/tools/list-dir.ts tests/unit/coding/
git commit -m "feat(coding): add search tools — glob, grep, list_dir"
```

---

### Task 5.4: ask_user tool + tools index + createCodingAgent factory

**Files:**
- Create: `src/coding/tools/ask-user.ts`
- Create: `src/coding/tools/index.ts`
- Create: `src/coding/agents/create-agent.ts`
- Create: `src/coding/agents/index.ts`
- Create: `src/coding/index.ts`

- [ ] **Step 1: Create ask_user tool**

Create `src/coding/tools/ask-user.ts`:
```typescript
import { defineTool } from '@/foundation/tools';
import { z } from 'zod';

export type AskUserHandler = (question: string) => Promise<string>;

let askUserHandler: AskUserHandler = async (question) => {
  return `[No UI available] Question was: ${question}`;
};

export function setAskUserHandler(handler: AskUserHandler): void {
  askUserHandler = handler;
}

export const askUserTool = defineTool({
  name: 'ask_user',
  description: 'Ask the user a question and wait for their response.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  invoke: async ({ question }) => {
    return askUserHandler(question);
  },
});
```

- [ ] **Step 2: Create tools index**

Create `src/coding/tools/index.ts`:
```typescript
export { bashTool } from './bash';
export { readFileTool } from './read-file';
export { writeFileTool } from './write-file';
export { strReplaceTool } from './str-replace';
export { globTool } from './glob';
export { grepTool } from './grep';
export { listDirTool } from './list-dir';
export { askUserTool, setAskUserHandler } from './ask-user';
export type { AskUserHandler } from './ask-user';

import { bashTool } from './bash';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { strReplaceTool } from './str-replace';
import { globTool } from './glob';
import { grepTool } from './grep';
import { listDirTool } from './list-dir';
import { askUserTool } from './ask-user';

export const standardTools = [
  bashTool,
  readFileTool,
  writeFileTool,
  strReplaceTool,
  globTool,
  grepTool,
  listDirTool,
  askUserTool,
];
```

- [ ] **Step 3: Create createCodingAgent factory**

Create `src/coding/agents/create-agent.ts`:
```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Agent } from '@/agent/agent';
import type { Model } from '@/foundation/models/model';
import { createSkillsMiddleware } from '@/agent/skills';
import { standardTools } from '../tools';
import { createUserMessage } from '@/foundation/messages';
import type { NonSystemMessage } from '@/foundation/messages/types';

export interface CodingAgentOptions {
  model: Model;
  cwd?: string;
  skillsDirs?: string[];
  maxSteps?: number;
}

export async function createCodingAgent(options: CodingAgentOptions): Promise<Agent> {
  const cwd = options.cwd ?? process.cwd();
  const skillsDirs = options.skillsDirs ?? [join(cwd, 'skills')];
  const messages: NonSystemMessage[] = [];

  // Load AGENTS.md if it exists
  try {
    const agentsPath = join(cwd, 'AGENTS.md');
    const content = await readFile(agentsPath, 'utf-8');
    messages.push(createUserMessage(`[AGENTS.md automatically loaded]\n${content}`));
  } catch {
    // No AGENTS.md — that's fine
  }

  const prompt = `<agent name="tiny-codex" role="coding_assistant">
You are a coding assistant. Use the provided tools to read, write, and modify files.
Work in the project directory: ${cwd}
</agent>`;

  return new Agent({
    model: options.model,
    prompt,
    messages,
    tools: standardTools,
    middlewares: [createSkillsMiddleware(skillsDirs)],
    maxSteps: options.maxSteps ?? 100,
  });
}
```

Create `src/coding/agents/index.ts`:
```typescript
export { createCodingAgent } from './create-agent';
export type { CodingAgentOptions } from './create-agent';
```

Create `src/coding/index.ts`:
```typescript
export { createCodingAgent } from './agents';
export { standardTools } from './tools';
export * from './tools';
```

- [ ] **Step 4: Commit**

```bash
git add src/coding/
git commit -m "feat(coding): add ask_user tool, tools index, createCodingAgent factory"
```

---

### Task 5.5: Integration test — Agent with real file tools

**Files:**
- Test: `tests/integration/agent-tools.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/agent-tools.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent } from '@/agent/agent';
import { Model } from '@/foundation/models/model';
import { MockModelProvider } from '../fixtures/mock-provider';
import { readFileTool, writeFileTool, strReplaceTool, listDirTool } from '@/coding/tools';
import { createUserMessage } from '@/foundation/messages';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('Agent + File Tools Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-integration-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('agent creates a file, reads it, then modifies it', async () => {
    const filePath = join(tmpDir, 'test.ts');

    const provider = new MockModelProvider([
      // Step 1: Agent writes a file
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c1', name: 'write_file',
          input: { path: filePath, content: 'const x = 1;\n' },
        }],
      },
      // Step 2: Agent reads the file
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c2', name: 'read_file',
          input: { path: filePath },
        }],
      },
      // Step 3: Agent modifies the file
      {
        role: 'assistant',
        content: [{
          type: 'tool_use', id: 'c3', name: 'str_replace',
          input: { path: filePath, old_string: 'const x = 1;', new_string: 'const x = 42;' },
        }],
      },
      // Step 4: Done
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Done! x is now 42.' }],
      },
    ]);

    const model = new Model('test', provider);
    const agent = new Agent({
      model,
      prompt: 'test',
      tools: [readFileTool, writeFileTool, strReplaceTool, listDirTool],
    });

    const messages = [];
    for await (const msg of agent.stream(createUserMessage('create and modify a file'))) {
      messages.push(msg);
    }

    // Verify the file was actually modified on disk
    const finalContent = await readFile(filePath, 'utf-8');
    expect(finalContent).toBe('const x = 42;\n');

    // 7 messages: 3 assistant + 3 tool + 1 final assistant
    expect(messages).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration/agent-tools.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-tools.test.ts
git commit -m "test(integration): agent + real file tools — create, read, modify files"
```

---

## Phase 6: Electron Shell + Database (TDD)

> Phases 6-9 cover the Electron app. From here, tasks focus on the main process, IPC, database, and React UI.

### Task 6.1: SQLite database

**Files:**
- Create: `src/main/db.ts`
- Test: `tests/integration/thread-manager.test.ts`

- [ ] **Step 1: Install better-sqlite3**

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 2: Write failing tests**

Create `tests/integration/thread-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '@/main/db';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import os from 'os';

describe('Database', () => {
  let tmpDir: string;
  let db: Database;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(os.tmpdir(), 'tiny-codex-db-'));
    db = new Database(join(tmpDir, 'test.db'));
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('threads', () => {
    it('creates and retrieves a thread', () => {
      const id = db.createThread({ title: 'Test Thread', projectPath: '/tmp/project', modelId: 'gpt-4o', mode: 'local' });
      const thread = db.getThread(id);
      expect(thread).toBeDefined();
      expect(thread!.title).toBe('Test Thread');
      expect(thread!.mode).toBe('local');
    });

    it('lists all threads sorted by updated_at desc', () => {
      db.createThread({ title: 'First', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.createThread({ title: 'Second', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      const threads = db.listThreads();
      expect(threads).toHaveLength(2);
      expect(threads[0].title).toBe('Second');
    });

    it('deletes a thread and its messages', () => {
      const id = db.createThread({ title: 'ToDelete', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.addMessage(id, { role: 'user', content: [{ type: 'text', text: 'hi' }] });
      db.deleteThread(id);
      expect(db.getThread(id)).toBeNull();
      expect(db.getMessages(id)).toHaveLength(0);
    });
  });

  describe('messages', () => {
    it('adds and retrieves messages for a thread', () => {
      const threadId = db.createThread({ title: 'Test', projectPath: '/tmp', modelId: 'gpt-4o', mode: 'local' });
      db.addMessage(threadId, { role: 'user', content: [{ type: 'text', text: 'hello' }] });
      db.addMessage(threadId, { role: 'assistant', content: [{ type: 'text', text: 'hi' }] });
      const messages = db.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });
});
```

- [ ] **Step 3: Run tests — verify fail**

Run: `npx vitest run tests/integration/thread-manager.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement Database class**

Create `src/main/db.ts`:
```typescript
import BetterSqlite3 from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface ThreadRow {
  id: string;
  title: string;
  project_path: string;
  model_id: string;
  mode: 'local' | 'worktree';
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  role: string;
  content: string; // JSON
  is_compact_boundary: number;
  created_at: number;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(filePath: string) {
    this.db = new BetterSqlite3(filePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_path TEXT NOT NULL,
        model_id TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        is_compact_boundary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
    `);
  }

  createThread(params: { title: string; projectPath: string; modelId: string; mode: 'local' | 'worktree' }): string {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO threads (id, title, project_path, model_id, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, params.title, params.projectPath, params.modelId, params.mode, now, now);
    return id;
  }

  getThread(id: string): ThreadRow | null {
    return this.db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow | null;
  }

  listThreads(): ThreadRow[] {
    return this.db.prepare('SELECT * FROM threads ORDER BY updated_at DESC').all() as ThreadRow[];
  }

  deleteThread(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE thread_id = ?').run(id);
    this.db.prepare('DELETE FROM threads WHERE id = ?').run(id);
  }

  addMessage(threadId: string, message: { role: string; content: unknown[] }): string {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO messages (id, thread_id, role, content, is_compact_boundary, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    ).run(id, threadId, message.role, JSON.stringify(message.content), now);
    this.db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(now, threadId);
    return id;
  }

  getMessages(threadId: string): Array<{ id: string; role: string; content: unknown[]; created_at: number }> {
    const rows = this.db.prepare(
      'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC',
    ).all(threadId) as MessageRow[];
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: JSON.parse(r.content),
      created_at: r.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/integration/thread-manager.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/db.ts tests/integration/thread-manager.test.ts
git commit -m "feat(main): add SQLite database with threads + messages tables"
```

---

### Task 6.2: Electron main process + window + preload

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/window.ts`
- Create: `src/main/preload.ts`
- Create: `src/shared/ipc-channels.ts`

- [ ] **Step 1: Create IPC channel definitions**

Create `src/shared/ipc-channels.ts`:
```typescript
export const IPC = {
  // Thread management
  THREAD_CREATE: 'thread:create',
  THREAD_LIST: 'thread:list',
  THREAD_DELETE: 'thread:delete',
  THREAD_GET_MESSAGES: 'thread:getMessages',

  // Agent
  AGENT_SEND_MESSAGE: 'agent:sendMessage',
  AGENT_ABORT: 'agent:abort',
  AGENT_STREAM_CHUNK: 'agent:streamChunk',
  AGENT_STREAM_END: 'agent:streamEnd',
  AGENT_STREAM_ERROR: 'agent:streamError',

  // File operations
  FILE_OPEN_PROJECT: 'file:openProject',
  FILE_COMMIT: 'file:commit',

  // Git
  GIT_DIFF_STATS: 'git:diffStats',
} as const;
```

- [ ] **Step 2: Create preload script**

Create `src/main/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@/shared/ipc-channels';

contextBridge.exposeInMainWorld('api', {
  // Thread management
  createThread: (params: any) => ipcRenderer.invoke(IPC.THREAD_CREATE, params),
  listThreads: () => ipcRenderer.invoke(IPC.THREAD_LIST),
  deleteThread: (id: string) => ipcRenderer.invoke(IPC.THREAD_DELETE, id),
  getMessages: (threadId: string) => ipcRenderer.invoke(IPC.THREAD_GET_MESSAGES, threadId),

  // Agent
  sendMessage: (threadId: string, text: string) => ipcRenderer.invoke(IPC.AGENT_SEND_MESSAGE, threadId, text),
  abortAgent: (threadId: string) => ipcRenderer.invoke(IPC.AGENT_ABORT, threadId),
  onStreamChunk: (cb: (msg: any) => void) => {
    const handler = (_: any, msg: any) => cb(msg);
    ipcRenderer.on(IPC.AGENT_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_CHUNK, handler);
  },
  onStreamEnd: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC.AGENT_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_END, handler);
  },
  onStreamError: (cb: (err: string) => void) => {
    const handler = (_: any, err: string) => cb(err);
    ipcRenderer.on(IPC.AGENT_STREAM_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.AGENT_STREAM_ERROR, handler);
  },

  // File
  openProject: () => ipcRenderer.invoke(IPC.FILE_OPEN_PROJECT),
  commit: (message: string) => ipcRenderer.invoke(IPC.FILE_COMMIT, message),
  getDiffStats: () => ipcRenderer.invoke(IPC.GIT_DIFF_STATS),
});
```

- [ ] **Step 3: Create window manager**

Create `src/main/window.ts`:
```typescript
import { BrowserWindow, app } from 'electron';
import { join } from 'path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

- [ ] **Step 4: Create main entry point**

Create `src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { Database } from './db';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;
let db: Database;

app.whenReady().then(() => {
  // Initialize database
  const dbPath = join(app.getPath('userData'), 'tiny-codex.db');
  db = new Database(dbPath);

  // Create window
  mainWindow = createMainWindow();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add src/main/ src/shared/
git commit -m "feat(main): add Electron main process, window, preload, IPC channels"
```

---

## Phases 7-9: UI Components, Preview System, E2E

> Phases 7-9 follow the same TDD pattern:
> - **Phase 7:** Vite config for renderer, React App shell, Zustand stores, Sidebar, ChatPanel, InputBox, Titlebar, Welcome
> - **Phase 8:** Preview Panel with Monaco Editor, Markdown, Image, PDF, CSV/JSON, HTML renderers
> - **Phase 9:** IPC handler wiring, ThreadManager (Agent + DB bridge), full E2E tests with Playwright
>
> These phases will be detailed in follow-up plans once Phases 1-6 are implemented and validated.
> Each follows the same task structure: failing test → minimal implementation → verify → commit.

---

## Execution Order Summary

| Phase | What | Tests | Estimated Tasks |
|-------|------|-------|-----------------|
| 1 | Project scaffolding + test infra | Vitest + Playwright setup | 4 tasks |
| 2 | Foundation Layer | 3 unit test files | 3 tasks |
| 3 | Community Layer (Providers) | 2 unit test files | 3 tasks |
| 4 | Agent Layer | 4 unit + 1 integration test | 5 tasks |
| 5 | Coding Layer (Tools) | 6 unit + 1 integration test | 5 tasks |
| 6 | Electron Shell + DB | 1 integration test | 2 tasks |
| 7 | UI Components | Component tests (TBD) | ~8 tasks |
| 8 | Preview System | Component tests (TBD) | ~6 tasks |
| 9 | E2E Integration | Playwright E2E | ~4 tasks |

**Total Phases 1-6: 22 tasks, ~90 steps**
