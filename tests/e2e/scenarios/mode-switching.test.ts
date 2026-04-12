import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');

test.describe('Scenario: Mode Switching', () => {
  test('Local mode is default', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Local button should be active by default
    const localBtn = window.locator('.mode-btn.active');
    await expect(localBtn).toHaveText('Local', { timeout: 5000 });

    await app.close();
  });

  test('switch to Worktree mode', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    await window.locator('text=Worktree').first().click();

    // Worktree should now be active
    const activeBtn = window.locator('.mode-btn.active');
    await expect(activeBtn).toHaveText('Worktree', { timeout: 3000 });

    await app.close();
  });

  test('switch back to Local mode', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Switch to Worktree then back
    await window.locator('text=Worktree').first().click();
    await window.locator('text=Local').first().click();

    const activeBtn = window.locator('.mode-btn.active');
    await expect(activeBtn).toHaveText('Local', { timeout: 3000 });

    await app.close();
  });

  test('mode persists when creating thread', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Switch to Worktree
    await window.locator('text=Worktree').first().click();

    // Create a thread
    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('test mode persistence');
    await input.press('Enter');

    // Thread created
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    // Mode should still be Worktree
    const activeBtn = window.locator('.mode-btn.active');
    await expect(activeBtn).toHaveText('Worktree', { timeout: 3000 });

    await app.close();
  });
});
