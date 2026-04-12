import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');

test.describe('Scenario: Keyboard Shortcuts', () => {
  test('Cmd+N creates a new thread', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // No threads initially
    await expect(window.locator("text=Let's build")).toBeVisible();

    // Cmd+N
    await window.keyboard.press('Meta+n');

    // Thread should be created
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    await app.close();
  });

  test('titlebar shows Open and Commit buttons', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    await expect(window.locator('button >> text=Open')).toBeVisible({ timeout: 3000 });
    await expect(window.locator('button >> text=Commit')).toBeVisible({ timeout: 3000 });

    await app.close();
  });
});
