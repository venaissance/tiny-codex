import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');

test.describe('Scenario: Preview Panel', () => {
  test('preview panel is visible by default', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Preview panel should be rendered
    const previewPanel = window.locator('.preview-panel');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    await app.close();
  });

  test('preview panel toggle with keyboard shortcut Cmd+\\', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Initially visible
    const previewPanel = window.locator('.preview-panel');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    // Toggle off
    await window.keyboard.press('Meta+\\');
    await expect(previewPanel).not.toBeVisible({ timeout: 3000 });

    // Toggle on
    await window.keyboard.press('Meta+\\');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    await app.close();
  });

  test('preview panel shows tab bar', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();

    // Tab bar should show at least Preview and Code tabs
    await expect(window.locator('.preview-panel >> text=Preview')).toBeVisible({ timeout: 3000 });
    await expect(window.locator('.preview-panel >> text=Code')).toBeVisible({ timeout: 3000 });

    await app.close();
  });
});
