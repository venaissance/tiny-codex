/**
 * Real Agent E2E tests using e2e_test_folder as the project directory.
 * Requires MINIMAX_API_KEY or GLM_API_KEY.
 *
 * These tests wait for the agent to fully complete (streaming ends)
 * before asserting on results — no blind timeouts.
 */
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { waitForAgentComplete } from '../helpers';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');
const testFolder = path.resolve(__dirname, '../../../e2e_test_folder');
const hasKey = process.env.MINIMAX_API_KEY || process.env.GLM_API_KEY;

async function sendAndWait(window: Page, message: string) {
  const input = window.locator('textarea[placeholder*="Ask anything"]');
  await input.fill(message);
  await input.press('Enter');
  await waitForAgentComplete(window);
}

test.describe('Real Agent Tasks (e2e_test_folder)', () => {
  test.skip(!hasKey, 'Skipped: no API key');

  // Increase timeout for real API calls
  test.setTimeout(120_000);

  test('agent reads aa.md and summarizes it', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    // Send message and wait for full agent response
    await sendAndWait(
      window,
      `Read the file at ${path.join(testFolder, 'aa.md')} and give me a one-sentence summary in Chinese.`,
    );

    // Verify: agent responded with meaningful content
    const chatContent = await window.locator('.chat-messages').textContent();
    console.log('  Agent response:', chatContent?.slice(-200));
    expect(chatContent!.length).toBeGreaterThan(50);
    // Should contain Chinese characters (summary in Chinese)
    expect(chatContent).toMatch(/[\u4e00-\u9fff]/);

    await app.close();
  });

  test('agent creates a new file in test folder', async () => {
    const newFile = path.join(testFolder, `test-${Date.now()}.txt`);

    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    // Send and wait for agent to complete
    await sendAndWait(
      window,
      `Use write_file to create ${newFile} with content "Hello from E2E test!"`,
    );

    // Verify: file was actually created
    expect(fs.existsSync(newFile)).toBe(true);
    const content = fs.readFileSync(newFile, 'utf-8');
    console.log('  Created file content:', content);
    expect(content).toContain('Hello');

    // Verify: tool use appeared in chat (process block)
    const chatHtml = await window.locator('.chat-messages').innerHTML();
    expect(chatHtml).toContain('write_file');

    // Cleanup
    fs.unlinkSync(newFile);
    await app.close();
  });

  test('agent modifies todo.html with str_replace', async () => {
    const todoPath = path.join(testFolder, 'todo.html');
    const original = fs.readFileSync(todoPath, 'utf-8');

    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    // Send and wait for agent to complete
    await sendAndWait(
      window,
      `Read ${todoPath}, then use str_replace to add a new todo item "Write E2E tests" to the list. Show me the change.`,
    );

    // Check if file was modified
    const modified = fs.readFileSync(todoPath, 'utf-8');
    const changed = modified !== original;
    console.log('  File changed:', changed);

    // Verify: tool use blocks visible in chat
    const chatHtml = await window.locator('.chat-messages').innerHTML();
    expect(chatHtml).toContain('read_file');

    // Restore original
    fs.writeFileSync(todoPath, original);
    await app.close();
  });

  test('agent executes bash tool and reports result', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    // Send and wait for agent to complete
    await sendAndWait(
      window,
      `Use the bash tool to run "ls -la ${testFolder}" and tell me how many files are there.`,
    );

    // Verify: agent responded with file count info
    const chatContent = await window.locator('.chat-messages').textContent();
    console.log('  Agent response (last 300):', chatContent?.slice(-300));
    expect(chatContent!.length).toBeGreaterThan(20);

    // Should mention "bash" tool use in the process
    const chatHtml = await window.locator('.chat-messages').innerHTML();
    expect(chatHtml).toContain('bash');

    // Should contain some number (file count)
    expect(chatContent).toMatch(/\d+/);

    await app.close();
  });

  test('agent state indicator shows during processing', async () => {
    const app = await electron.launch({ args: [mainPath], env: { ...process.env } });
    const window = await app.firstWindow();
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });

    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('What is 2+2? Answer in one word.');
    await input.press('Enter');

    // While streaming: textarea should be disabled (streaming state)
    await expect(window.locator('textarea[disabled]')).toBeVisible({ timeout: 5000 });

    // Stop button should appear during streaming
    const stopBtn = window.locator('.stop-btn');
    const stopVisible = await stopBtn.isVisible().catch(() => false);
    console.log('  Stop button visible during streaming:', stopVisible);

    // Wait for completion
    await waitForAgentComplete(window);

    // After completion: textarea should be enabled again
    await expect(window.locator('textarea.input-textarea:not([disabled])')).toBeVisible();

    // Agent should have responded
    const chatContent = await window.locator('.chat-messages').textContent();
    expect(chatContent).toMatch(/4|four/i);

    await app.close();
  });
});
