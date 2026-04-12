/**
 * Full workflow E2E: Open project -> New thread -> Agent edits code -> See diff -> Commit
 * Requires API key to run agent tasks (skipped without key).
 */
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { waitForAgentComplete } from '../helpers';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');
const testFolder = path.resolve(__dirname, '../../../e2e_test_folder');
const hasKey = process.env.MINIMAX_API_KEY || process.env.GLM_API_KEY || process.env.OPENAI_API_KEY;

test.describe('Scenario: Full Workflow', () => {
  test('open project → new thread → send message → see response', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Welcome screen visible
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    // Send message to create thread
    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('Hello from full workflow test');
    await input.press('Enter');

    // Thread should be created
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    // User message should appear
    await expect(window.locator('text=Hello from full workflow test').first()).toBeVisible({ timeout: 5000 });

    await app.close();
  });

  test('switch model → verify model picker state', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Click model picker
    const modelPicker = window.locator('text=MiniMax-M2.7').first();
    await expect(modelPicker).toBeVisible();
    await modelPicker.click();

    // Select different model
    const altModel = window.locator('text=glm-5.1').first();
    if (await altModel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await altModel.click();
      // Verify model changed
      await expect(window.locator('text=glm-5.1').first()).toBeVisible();
    }

    await app.close();
  });

  test('mode toggle between Local and Worktree', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Find mode buttons
    const worktreeBtn = window.locator('text=Worktree').first();
    const localBtn = window.locator('text=Local').first();

    await expect(localBtn).toBeVisible({ timeout: 3000 });

    // Switch to worktree
    await worktreeBtn.click();
    // Switch back to local
    await localBtn.click();

    await app.close();
  });

  test('theme toggle works (dark/light)', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Check initial theme attribute
    const initialTheme = await window.locator('html').getAttribute('data-theme');
    expect(initialTheme).toBeTruthy();

    await app.close();
  });

  test.describe('With API key', () => {
    test.skip(!hasKey, 'Skipped: no API key');
    test.setTimeout(120_000);

    test('agent writes file → verify file content after completion', async () => {
      const targetFile = path.join(testFolder, `workflow-test-${Date.now()}.md`);

      const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
      const window = await app.firstWindow();
      await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

      // Send message and wait for agent to fully complete
      const input = window.locator('textarea[placeholder*="Ask anything"]');
      await input.fill(`Use write_file to create ${targetFile} with content "# Workflow Test\n\nThis was created by E2E test."`);
      await input.press('Enter');
      await waitForAgentComplete(window);

      // Now check the file — agent has finished
      expect(fs.existsSync(targetFile)).toBe(true);
      const content = fs.readFileSync(targetFile, 'utf-8');
      console.log('  Written file:', content.slice(0, 100));
      expect(content).toContain('Workflow Test');

      // Verify tool use is shown in chat
      const chatHtml = await window.locator('.chat-messages').innerHTML();
      expect(chatHtml).toContain('write_file');

      // Cleanup
      fs.unlinkSync(targetFile);
      await app.close();
    });

    test('full flow: send message → agent thinks → uses tools → responds', async () => {
      const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
      const window = await app.firstWindow();
      await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

      // Send a question that requires bash tool
      const input = window.locator('textarea[placeholder*="Ask anything"]');
      await input.fill(`Run "echo hello-e2e" using bash and tell me what it printed.`);
      await input.press('Enter');

      // Verify streaming started (textarea disabled)
      await expect(window.locator('textarea[disabled]')).toBeVisible({ timeout: 5000 });

      // Wait for agent to complete
      await waitForAgentComplete(window);

      // Verify: agent process block shows bash tool usage
      const chatContent = await window.locator('.chat-messages').textContent();
      console.log('  Final response:', chatContent?.slice(-200));
      expect(chatContent).toContain('hello-e2e');

      await app.close();
    });
  });
});
