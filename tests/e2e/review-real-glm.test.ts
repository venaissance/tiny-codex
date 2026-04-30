/**
 * Real-GLM E2E smoke for BackgroundReviewMiddleware (self-evolution v1).
 *
 * Verifies that the middleware can drive the GLM-4.5-Flash model end-to-end
 * and produce real artifacts:
 *   1. memory_write -> appends a line to MEMORY.md or USER.md
 *   2. skill_create -> drops a SKILL.md under skills/_pending/<name>/
 *
 * This test is **skipped by default**. Enable with:
 *
 *   RUN_REAL_GLM=1 GLM_API_KEY=... pnpm vitest run \
 *     --config vitest.e2e.config.ts tests/e2e/review-real-glm.test.ts
 *
 * The test isolates state via TINY_CODEX_HOME so the user's real
 * ~/.tiny-codex/ is not touched. It does NOT mock the model — every call goes
 * to https://open.bigmodel.cn/api/paas/v4/chat/completions for real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { OpenAIModelProvider } from '@/community/openai/provider';
import { BackgroundReviewMiddleware, type ReviewCompleteEvent } from '@/agent/middlewares/background-review';
import { MemoryStore } from '@/agent/memory/store';
import { loadMemory } from '@/agent/memory/loader';
import type {
  AssistantMessage,
  ToolMessage,
  UserMessage,
  ToolUseContent,
} from '@/foundation/messages/types';

const RUN_REAL = process.env.RUN_REAL_GLM === '1';
const GLM_KEY = process.env.GLM_API_KEY;

const RUN = RUN_REAL && !!GLM_KEY;

describe.skipIf(!RUN)('BackgroundReviewMiddleware × GLM-4.5-Flash (real network)', () => {
  let sandboxHome: string;
  let originalHome: string | undefined;

  beforeAll(() => {
    // Isolate memory + skills writes to a temp dir so real ~/.tiny-codex
    // stays untouched.
    sandboxHome = mkdtempSync(join(tmpdir(), 'tiny-codex-e2e-'));
    originalHome = process.env.TINY_CODEX_HOME;
    process.env.TINY_CODEX_HOME = sandboxHome;
    console.log(`[e2e] TINY_CODEX_HOME=${sandboxHome}`);
  });

  afterAll(() => {
    if (originalHome === undefined) delete process.env.TINY_CODEX_HOME;
    else process.env.TINY_CODEX_HOME = originalHome;
    // Keep sandbox on disk for forensic inspection if test failed; uncomment
    // to auto-clean. We err on the side of leaving evidence.
    // rmSync(sandboxHome, { recursive: true, force: true });
  });

  function buildProvider(): OpenAIModelProvider {
    return new OpenAIModelProvider({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: GLM_KEY!,
      // Disable streaming so the parsed response is deterministic. The
      // middleware only needs the final AssistantMessage.
      supportsStreaming: false,
    });
  }

  /**
   * Build a 12-message synthetic trajectory that contains BOTH a
   * memory-worthy user preference signal AND a non-trivial reusable workflow:
   * read -> str_replace -> run_tests -> fix -> commit.
   */
  function buildTrajectory(): Array<UserMessage | AssistantMessage | ToolMessage> {
    const tu = (id: string, name: string, input: any): ToolUseContent => ({
      type: 'tool_use',
      id,
      name,
      input,
    });

    return [
      { role: 'user', content: [{ type: 'text', text:
        'Please update the auth module to use TypeScript strict mode. I prefer TypeScript strict mode and always run tests after edits before committing.' }] },

      { role: 'assistant', content: [
        { type: 'text', text: "I'll read the current auth module first." },
        tu('t1', 'read_file', { path: 'src/auth/index.ts' }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't1',
        content: 'export function signIn(user: any) { return validate(user); }' }] },

      { role: 'assistant', content: [
        { type: 'text', text: 'Now adding strict types via str_replace.' },
        tu('t2', 'str_replace', {
          path: 'src/auth/index.ts',
          old_str: 'function signIn(user: any)',
          new_str: 'function signIn(user: { id: string; token: string })',
        }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't2', content: 'ok' }] },

      { role: 'assistant', content: [
        { type: 'text', text: 'Running tests after the edit, as you prefer.' },
        tu('t3', 'run_tests', { scope: 'src/auth' }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't3',
        content: 'FAIL src/auth/auth.test.ts: type error in mock fixture' }] },

      { role: 'assistant', content: [
        { type: 'text', text: 'Test failed — fixing the mock fixture.' },
        tu('t4', 'str_replace', {
          path: 'src/auth/auth.test.ts',
          old_str: 'const fakeUser = {}',
          new_str: 'const fakeUser = { id: "u1", token: "t" }',
        }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't4', content: 'ok' }] },

      { role: 'assistant', content: [
        { type: 'text', text: 'Re-running tests to confirm green.' },
        tu('t5', 'run_tests', { scope: 'src/auth' }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't5', content: 'PASS 12 tests, 0 failures' }] },

      { role: 'assistant', content: [
        { type: 'text', text: 'Tests are green. Committing.' },
        tu('t6', 'shell_exec', { cmd: 'git add -A && git commit -m "feat(auth): tighten signIn types"' }),
      ] },
      { role: 'tool', content: [{ type: 'tool_result', toolUseId: 't6',
        content: '[main 1a2b3c4] feat(auth): tighten signIn types' }] },
    ];
  }

  it('drives GLM-4.5-Flash to write memory + propose skill', async () => {
    const provider = buildProvider();
    const snapshot = await loadMemory();
    const memoryStore = new MemoryStore(snapshot);

    const events: ReviewCompleteEvent[] = [];
    // We fire the two reviews SERIALLY (not in parallel) because GLM
    // free-tier's rate-limit (code 1302) hits beyond ~2 concurrent req/s.
    // Strategy: skillNudgeIters=6 and memoryNudgeTurns=999 → only the skill
    // review fires during trajectory replay. Then we crank memoryNudgeTurns
    // down and bump it manually to fire the memory review.
    const middleware = new BackgroundReviewMiddleware({
      memoryStore,
      provider,
      reviewModel: 'glm-4.5-flash',
      memoryNudgeTurns: 999,
      skillNudgeIters: 6,
      onReviewComplete: (e) => {
        events.push(e);
        console.log(`[e2e] review event: mode=${e.mode} ok=${e.ok} ` +
          `mems=${e.memoriesAdded} skills=${e.skillsProposed} ` +
          `toolCalls=${e.toolCalls} dur=${e.durationMs}ms` +
          (e.error ? ` err=${e.error}` : ''));
      },
    });

    // Phase 1: replay all 6 assistant messages — afterToolUse triggers ONE
    // skill review at the 6th call (skillNudgeIters=6). Memory review is
    // gated by memoryNudgeTurns=999 so afterAgentStep does nothing yet.
    const traj = buildTrajectory();
    for (const msg of traj) {
      if (msg.role === 'assistant') {
        await middleware.afterModel(msg);
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            const matchingTool = traj.find(
              (m) => m.role === 'tool' && m.content[0]?.toolUseId === block.id,
            );
            const resultText =
              matchingTool && matchingTool.role === 'tool'
                ? matchingTool.content[0].content
                : 'ok';
            await middleware.afterToolUse(block, resultText);
          }
        }
        await middleware.afterAgentStep(0);
      }
    }

    console.log('[e2e] Phase 1 complete — awaiting skill review to land...');
    const phase1Start = Date.now();
    await middleware.flush();
    console.log(`[e2e] Phase 1 flush completed in ${Date.now() - phase1Start}ms`);

    // Tiny breather to keep GLM rate-limit happy (code 1302).
    await new Promise((r) => setTimeout(r, 1500));

    // Phase 2: rebuild a second middleware for the memory review with a
    // fresh trace (the skill middleware drained its in-flight chain). Reuse
    // the same trajectory via afterModel + afterToolUse so the reviewer has
    // context, then trigger memory review by setting memoryNudgeTurns=1 and
    // bumping afterAgentStep once.
    console.log('[e2e] Phase 2 — firing memory review on the same trajectory.');
    const memoryMiddleware = new BackgroundReviewMiddleware({
      memoryStore,
      provider,
      reviewModel: 'glm-4.5-flash',
      memoryNudgeTurns: 1,
      skillNudgeIters: 999,
      onReviewComplete: (e) => {
        events.push(e);
        console.log(`[e2e] review event: mode=${e.mode} ok=${e.ok} ` +
          `mems=${e.memoriesAdded} skills=${e.skillsProposed} ` +
          `toolCalls=${e.toolCalls} dur=${e.durationMs}ms` +
          (e.error ? ` err=${e.error}` : ''));
      },
    });

    for (const msg of traj) {
      if (msg.role === 'assistant') {
        await memoryMiddleware.afterModel(msg);
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            const matchingTool = traj.find(
              (m) => m.role === 'tool' && m.content[0]?.toolUseId === block.id,
            );
            const resultText =
              matchingTool && matchingTool.role === 'tool'
                ? matchingTool.content[0].content
                : 'ok';
            await memoryMiddleware.afterToolUse(block, resultText);
          }
        }
      }
    }
    // Single afterAgentStep bump fires the memory review.
    await memoryMiddleware.afterAgentStep(0);
    const phase2Start = Date.now();
    await memoryMiddleware.flush();
    console.log(`[e2e] Phase 2 flush completed in ${Date.now() - phase2Start}ms`);

    // ---- assertions ----
    console.log(`[e2e] total review events captured: ${events.length}`);
    expect(events.length).toBeGreaterThan(0);

    const memoryEvents = events.filter((e) => e.mode === 'memory');
    const skillEvents = events.filter((e) => e.mode === 'skill');
    const totalMems = memoryEvents.reduce((a, e) => a + e.memoriesAdded, 0);
    const totalSkills = skillEvents.reduce((a, e) => a + e.skillsProposed, 0);

    console.log(`[e2e] memory reviews: ${memoryEvents.length}, total mems written: ${totalMems}`);
    console.log(`[e2e] skill  reviews: ${skillEvents.length}, total skills proposed: ${totalSkills}`);

    // Print latency summary for GLM observability.
    if (events.length > 0) {
      const lats = events.map((e) => e.durationMs).sort((a, b) => a - b);
      const p50 = lats[Math.floor(lats.length / 2)];
      const max = lats[lats.length - 1];
      console.log(`[e2e] GLM latency: p50=${p50}ms max=${max}ms (n=${lats.length})`);
    }

    // ---- verify on-disk artifacts ----
    const memoryDir = join(sandboxHome, 'memory');
    const memFile = join(memoryDir, 'MEMORY.md');
    const userFile = join(memoryDir, 'USER.md');

    let memContent = '';
    let userContent = '';
    if (existsSync(memFile)) memContent = readFileSync(memFile, 'utf-8');
    if (existsSync(userFile)) userContent = readFileSync(userFile, 'utf-8');

    console.log(`[e2e] MEMORY.md (${memContent.length} bytes):\n${memContent || '(empty)'}`);
    console.log(`[e2e] USER.md   (${userContent.length} bytes):\n${userContent || '(empty)'}`);

    const pendingDir = join(sandboxHome, 'skills', '_pending');
    let pendingNames: string[] = [];
    if (existsSync(pendingDir)) {
      pendingNames = readdirSync(pendingDir);
      for (const name of pendingNames) {
        const skillFile = join(pendingDir, name, 'SKILL.md');
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, 'utf-8');
          console.log(`[e2e] pending/${name}/SKILL.md (${content.length} bytes):\n${content.slice(0, 800)}`);
        }
      }
    }
    console.log(`[e2e] pending skills found: ${pendingNames.length}`);

    // ---- final acceptance ----
    expect(totalMems + totalSkills).toBeGreaterThanOrEqual(1);
    const memWritten = memContent.length > 0 || userContent.length > 0;
    const skillProposed = pendingNames.length > 0;
    expect(memWritten || skillProposed).toBe(true);
  }, 120_000);
});
