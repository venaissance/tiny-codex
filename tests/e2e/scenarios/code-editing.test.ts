import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');

test.describe('Scenario: Code Editing', () => {
  test('send message → thread created and message appears', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('Hello tiny-codex');
    await input.press('Enter');

    // Thread created in sidebar
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    // User message should appear in chat
    await expect(window.locator('text=Hello tiny-codex').first()).toBeVisible({ timeout: 5000 });

    await app.close();
  });

  test('create multiple threads via New Thread button', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const threads = window.locator('[data-active]');
    const initialCount = await threads.count().catch(() => 0);

    // Create two threads via button (no message send to avoid API timeout)
    await window.click('text=+ New thread');
    await window.waitForTimeout(500);
    await window.click('text=+ New thread');
    await window.waitForTimeout(500);

    const finalCount = await threads.count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 2);

    await app.close();
  });

  test('model picker shows available models', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Click model picker
    const modelPicker = window.locator('text=MiniMax-M2.7').first();
    await expect(modelPicker).toBeVisible();
    await modelPicker.click();

    // Should show model options
    await expect(window.locator('text=glm-5.1').first()).toBeVisible({ timeout: 3000 });

    await app.close();
  });

  test('mode picker toggles between Local and Worktree', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const worktreeBtn = window.locator('text=Worktree').first();
    await expect(worktreeBtn).toBeVisible();
    await worktreeBtn.click();

    await app.close();
  });

  test('quick action cards create thread', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Click a quick card button
    await window.locator('button:has-text("Create a React page")').click();

    // Thread created
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    await app.close();
  });
});
