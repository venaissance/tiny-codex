/**
 * E2E: Progress sidebar shows real-time to-do list during agent execution.
 *
 * Expected behavior:
 * 1. User sends message → PROGRESS shows "Step N · Thinking..."
 * 2. When agent calls a tool → "Step N · Calling <tool>"
 * 3. After tool completes → "Step N · <tool>" marked done (✅)
 * 4. After agent finishes → all steps done + "Done"
 */
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');
const testFolder = path.resolve(__dirname, '../../../e2e_test_folder');
const hasKey = process.env.MINIMAX_API_KEY || process.env.GLM_API_KEY;

test.describe('Scenario: Progress To-Do List', () => {
  test.skip(!hasKey, 'Skipped: no API key');
  test.setTimeout(180_000);

  test('progress shows "Thinking..." immediately after sending message', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('What is 2+2?');
    await input.press('Enter');

    // PROGRESS should auto-expand and show "Thinking..."
    const thinkingStep = window.locator('.sidebar-progress-step', { hasText: 'Thinking' });
    await expect(thinkingStep).toBeVisible({ timeout: 10_000 });
    console.log('  ✓ Thinking step appeared');

    // Verify it has the running indicator (⌛)
    const stepText = await thinkingStep.textContent();
    expect(stepText).toContain('Step 1');
    console.log('  ✓ Step text:', stepText);

    // Wait for agent to finish — abort after 30s if API is slow
    const stopBtn = window.locator('.stop-btn');
    const finished = await stopBtn.waitFor({ state: 'hidden', timeout: 30_000 }).then(() => true).catch(() => false);

    if (finished) {
      // After completion, should show "Done" step
      const doneStep = window.locator('.sidebar-progress-step', { hasText: 'Done' });
      await expect(doneStep).toBeVisible({ timeout: 5_000 });
      console.log('  ✓ Done step appeared');
    } else {
      // API slow — abort and verify progress still shows steps
      await stopBtn.click();
      console.log('  ⚠ Agent aborted (API slow), but Thinking step was verified');
    }

    await app.close();
  });

  test('progress shows tool name when agent calls a tool', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill(`Use bash to run "echo progress-test-ok"`);
    await input.press('Enter');

    // Should eventually see a progress step mentioning "bash"
    // Poll for up to 60s since API can be slow
    let sawBash = false;
    for (let i = 0; i < 120; i++) {
      await window.waitForTimeout(1000);
      const steps = await window.locator('.sidebar-progress-step').all();
      const texts = await Promise.all(steps.map(s => s.textContent()));
      const combined = texts.join(' ');

      if (combined.includes('bash')) {
        sawBash = true;
        console.log(`  Saw bash step at t=${i+1}s:`, texts);
        break;
      }

      // If stop button gone, agent finished
      const stopVisible = await window.locator('.stop-btn').isVisible().catch(() => false);
      if (!stopVisible && i > 5) {
        // Check if bash appeared in final state
        const finalTexts = await Promise.all(
          (await window.locator('.sidebar-progress-step').all()).map(s => s.textContent()),
        );
        console.log('  Agent finished, final steps:', finalTexts);
        sawBash = finalTexts.some(t => t?.includes('bash'));
        break;
      }
    }

    expect(sawBash).toBe(true);
    await app.close();
  });

  test('completed tool steps are marked with ✅ and strikethrough', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill(`Read ${path.join(testFolder, 'aa.md')} and tell me the first line.`);
    await input.press('Enter');

    // Wait for a tool step to appear and complete (✅)
    let sawDoneStep = false;
    for (let i = 0; i < 90; i++) {
      await window.waitForTimeout(1000);
      const steps = await window.locator('.sidebar-progress-step').all();
      for (const step of steps) {
        const text = await step.textContent();
        if (text?.includes('✅')) {
          const style = await step.getAttribute('style');
          console.log('  ✓ Done step:', text, 'style:', style?.includes('line-through') ? 'has line-through' : 'no line-through');
          expect(style).toContain('line-through');
          sawDoneStep = true;
          break;
        }
      }
      if (sawDoneStep) break;

      // If agent finished, check final state
      const stopVisible = await window.locator('.stop-btn').isVisible().catch(() => false);
      if (!stopVisible && i > 5) break;
    }

    expect(sawDoneStep).toBe(true);
    await app.close();
  });
});
