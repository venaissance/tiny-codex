import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../dist/main/main/index.js');

test('debug: check window.api and console errors', async () => {
  const app = await electron.launch({
    args: [mainPath],
    env: { ...process.env },
  });

  const window = await app.firstWindow();

  // Collect console messages
  const logs: string[] = [];
  window.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Wait for page to load
  await window.waitForTimeout(3000);

  // Check if window.api exists
  const hasApi = await window.evaluate(() => typeof (window as any).api !== 'undefined');
  console.log('window.api exists:', hasApi);

  if (hasApi) {
    const apiKeys = await window.evaluate(() => Object.keys((window as any).api));
    console.log('window.api methods:', apiKeys);
  }

  // Check page content
  const bodyText = await window.locator('body').textContent();
  console.log('Body text (first 200 chars):', bodyText?.slice(0, 200));

  // Print all console logs
  console.log('--- Console logs ---');
  for (const log of logs) {
    console.log(log);
  }

  // Check for errors in main process
  const mainLogs = await app.evaluate(({ app }) => {
    return (app as any)._logs || 'no logs captured';
  }).catch(() => 'evaluate failed');
  console.log('Main process:', mainLogs);

  await app.close();
});
