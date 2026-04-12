import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../dist/main/main/index.js');

test.describe('App Launch', () => {
  test('electron window opens with correct title', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();
    const title = await window.title();
    expect(title).toContain('tiny-codex');
    await app.close();
  });

  test('shows welcome screen when no project is open', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible();
    await app.close();
  });

  test('shows sidebar with New thread button', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();
    await expect(window.locator('text=+ New thread')).toBeVisible();
    await app.close();
  });

  test('shows input box', async () => {
    const app = await electron.launch({ args: [mainPath] });
    const window = await app.firstWindow();
    await expect(window.locator('textarea[placeholder*="Ask anything"]')).toBeVisible();
    await app.close();
  });
});
