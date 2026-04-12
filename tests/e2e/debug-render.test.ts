import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../dist/main/main/index.js');

test('debug: check page content and errors', async () => {
  const app = await electron.launch({ args: [mainPath] });
  const window = await app.firstWindow();

  const errors: string[] = [];
  window.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  window.on('pageerror', (err) => errors.push(err.message));

  await window.waitForTimeout(5000);

  const html = await window.content();
  console.log('Page HTML (first 500):', html.slice(0, 500));
  console.log('Errors:', errors);

  // Check if React root mounted
  const rootContent = await window.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 200));
  console.log('Root innerHTML:', rootContent);

  await app.close();
});
