import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../dist/main/main/index.js');

test.describe('Thread Lifecycle', () => {
  test('create a new thread → appears in sidebar', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Count existing threads before creating new one
    const threadItems = window.locator('[data-active]');
    const initialCount = await threadItems.count().catch(() => 0);

    await window.click('text=+ New thread');

    // Should have at least one more thread than before
    await expect(threadItems).not.toHaveCount(initialCount, { timeout: 5000 });

    await app.close();
  });

  test('type message without thread → auto-creates thread', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('hello');
    await input.press('Enter');

    // Thread should be created automatically
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    await app.close();
  });
});
