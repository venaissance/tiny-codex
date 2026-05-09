import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  writePendingSkill,
  confirmPendingSkill,
  activeSkillsRoot,
} from '@/agent/skills/skill-pending';
import { createSkillsMiddleware, globalSkillsDir } from '@/agent/skills';

/**
 * Regression test for C1 (review finding): confirmed skills must end up in a
 * directory the agent's skills-middleware actually loads. Before the fix,
 * skill-pending wrote to ~/.tiny-codex/skills/<name>/ but thread-manager and
 * the IPC list-skills handler only scanned [appRoot/skills, projectPath/skills],
 * so confirmed skills were invisible to the running agent.
 *
 * This test pins the contract:
 *   1. globalSkillsDir() resolves to the confirmed-skill destination.
 *   2. Wiring globalSkillsDir() into skillsDirs lets the middleware see
 *      a confirmed skill on the very next session.
 *
 * Failure mode if regressed: list will be empty, asserting the agent never
 * picks up confirmed skills.
 */
describe('skill-pending → middleware load (C1 regression)', () => {
  let tempHome: string;
  const originalEnv = process.env.TINY_CODEX_HOME;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'tinycdx-load-'));
    process.env.TINY_CODEX_HOME = tempHome;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TINY_CODEX_HOME;
    else process.env.TINY_CODEX_HOME = originalEnv;
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('globalSkillsDir() points to the confirmed-skill destination', () => {
    expect(globalSkillsDir()).toBe(activeSkillsRoot());
    expect(globalSkillsDir()).toBe(join(tempHome, 'skills'));
  });

  it('confirmed skill is discoverable by skills-middleware', async () => {
    // 1. Write a pending skill (what background-review's skill_create does).
    const writeRes = await writePendingSkill({
      name: 'load-flaky-test',
      description: 'Reproduce and stabilise a flaky test',
      triggers: ['flaky test', 'intermittent CI failure'],
      body: 'Step 1: rerun in a loop\nStep 2: capture state at first failure',
    });
    expect(writeRes.ok).toBe(true);

    // 2. User confirms — moves it into the active dir.
    const confirmRes = await confirmPendingSkill('load-flaky-test');
    expect(confirmRes.ok).toBe(true);
    expect(existsSync(join(activeSkillsRoot(), 'load-flaky-test', 'SKILL.md'))).toBe(true);

    // 3. Build skills-middleware with the SAME dir list the production
    //    factory uses (global, app, project). This is the critical wiring
    //    the C1 fix ensures.
    const projectDir = mkdtempSync(join(tmpdir(), 'tinycdx-prj-'));
    const appDir = mkdtempSync(join(tmpdir(), 'tinycdx-app-'));
    try {
      const controller = createSkillsMiddleware([
        globalSkillsDir(),
        join(appDir, 'skills'),
        join(projectDir, 'skills'),
      ]);

      // 4. Drive the middleware lifecycle. beforeAgentRun loads the skill
      //    list; beforeModel injects it into the prompt.
      await controller.middleware.beforeAgentRun!({
        threadId: 'test-thread',
        step: 0,
      } as any);
      const result = await controller.middleware.beforeModel!({
        prompt: 'BASE_PROMPT',
      } as any);

      // 5. The injected prompt MUST mention the confirmed skill name.
      const augmented = (result as { prompt: string } | undefined)?.prompt ?? '';
      expect(augmented).toContain('load-flaky-test');
      expect(augmented).toContain('Reproduce and stabilise a flaky test');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
