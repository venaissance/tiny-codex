import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');

test.describe('Scenario: Blog Writing + Image Gen', () => {
  test('@ shows file picker', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('@');

    // File picker should appear (even if empty - "No project opened")
    const picker = window.locator('.skill-picker').first();
    await expect(picker).toBeVisible({ timeout: 3000 });

    await app.close();
  });

  test('/ shows command picker with skills', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('/');

    // Command picker should show skills
    const picker = window.locator('.skill-picker').first();
    await expect(picker).toBeVisible({ timeout: 3000 });
    await expect(picker.locator('text=Image Gen')).toBeVisible({ timeout: 3000 });

    await app.close();
  });

  test('/ select skill inserts tag', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('/');

    // Click Image Gen skill
    await window.locator('.skill-picker').locator('text=Image Gen').click();

    // Skill tag should appear
    const tag = window.locator('.skill-tag').first();
    await expect(tag).toBeVisible({ timeout: 3000 });
    await expect(tag).toContainText('Image Gen');

    await app.close();
  });
});
