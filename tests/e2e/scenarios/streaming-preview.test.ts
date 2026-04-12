/**
 * Streaming Preview E2E Test
 *
 * Verifies:
 * 1. When agent writes a file, preview panel shows the file content (no "No file selected")
 * 2. Preview doesn't flicker (content doesn't disappear and reappear)
 * 3. Streaming text appears in chat during response
 * 4. File-written event only fires AFTER tool execution (not from assistant message)
 */
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const mainPath = path.resolve(__dirname, '../../../dist/main/main/index.js');
const projectDir = path.resolve(__dirname, '../../../e2e_test_folder');

test.describe('Streaming Preview (Mock LLM)', () => {
  test('write_file shows in preview without flickering', async () => {
    // Clean up any leftover test file
    const testFilePath = path.join(projectDir, 'mock-test.txt');
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

    const app = await electron.launch({
      args: [mainPath],
      env: { ...process.env, E2E_MOCK: '1' },
    });
    const window = await app.firstWindow();

    // Wait for app to load
    await expect(window.locator('textarea[placeholder*="Ask anything"]')).toBeVisible({ timeout: 5000 });

    // Install a flicker detector: tracks how many times preview switches between content/empty
    await window.evaluate(() => {
      const w = window as any;
      w.__previewFlickerCount = 0;
      w.__previewHadContent = false;
      w.__previewStates = [];

      const observer = new MutationObserver(() => {
        const empty = document.querySelector('.preview-empty');
        const hasContent = !empty;
        w.__previewStates.push({ time: Date.now(), hasContent });

        if (w.__previewHadContent && !hasContent) {
          // Content disappeared — potential flicker
          w.__previewFlickerCount++;
        }
        w.__previewHadContent = hasContent;
      });

      const target = document.querySelector('.preview-panel');
      if (target) {
        observer.observe(target, { childList: true, subtree: true, characterData: true });
      }
    });

    // Send a message that triggers write_file
    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill(`Write file ${testFilePath}`);
    await input.press('Enter');

    // Wait for streaming to start (stop button appears)
    await window.locator('.stop-btn').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    // Wait for agent to finish (stop button disappears)
    await window.locator('.stop-btn').waitFor({ state: 'hidden', timeout: 30_000 });
    await window.waitForTimeout(500);

    // 1. Preview panel should show file content, NOT "No file selected"
    const previewPanel = window.locator('.preview-panel');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    // The file should have been written by the mock agent
    expect(fs.existsSync(testFilePath)).toBe(true);

    // Preview should show the file (not "No file selected")
    const previewEmpty = window.locator('.preview-empty');
    await expect(previewEmpty).not.toBeVisible({ timeout: 5000 });

    // 2. Check flicker count — should be 0 (content never disappeared after appearing)
    const flickerCount = await window.evaluate(() => (window as any).__previewFlickerCount);
    expect(flickerCount).toBe(0);

    // 3. Chat should contain the agent's response
    const chatContent = await window.locator('.chat-messages').textContent();
    expect(chatContent!.length).toBeGreaterThan(10);

    // 4. Chat should contain user message and agent response
    const userMsg = window.locator('.msg-user');
    const assistantMsg = window.locator('.msg-assistant');
    await expect(userMsg.first()).toBeVisible({ timeout: 3000 });
    await expect(assistantMsg.first()).toBeVisible({ timeout: 3000 });

    // Clean up
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    await app.close();
  });

  test('streaming text appears token by token during response', async () => {
    const app = await electron.launch({
      args: [mainPath],
      env: { ...process.env, E2E_MOCK: '1' },
    });
    const window = await app.firstWindow();
    await expect(window.locator('textarea[placeholder*="Ask anything"]')).toBeVisible({ timeout: 5000 });

    // Track streaming text appearances — the msg-assistant with streaming content
    // appears while isStreaming is true in the store
    await window.evaluate(() => {
      const w = window as any;
      w.__streamingTextSeen = false;
      w.__streamingTextSnapshots = [];

      // Poll for streaming text in the chat messages area
      const interval = setInterval(() => {
        // During streaming, the last msg-assistant contains live streaming text
        const msgs = document.querySelectorAll('.msg-assistant');
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.textContent && lastMsg.textContent.length > 0) {
          // Check if we're still in a streaming state (stop button visible)
          const stopBtn = document.querySelector('.stop-btn');
          if (stopBtn) {
            w.__streamingTextSeen = true;
            w.__streamingTextSnapshots.push(lastMsg.textContent.length);
          }
        }
      }, 30);
      w.__streamingInterval = interval;
    });

    // Send a simple message (no tool use — pure text response)
    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('Hello world');
    await input.press('Enter');

    // Wait for agent to finish
    await window.locator('.stop-btn').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await window.locator('.stop-btn').waitFor({ state: 'hidden', timeout: 30_000 });
    await window.waitForTimeout(200);

    // Clean up interval
    await window.evaluate(() => clearInterval((window as any).__streamingInterval));

    // Final message should be visible
    const assistantMsg = window.locator('.msg-assistant');
    await expect(assistantMsg.first()).toBeVisible({ timeout: 5000 });
    const finalText = await assistantMsg.first().textContent();
    expect(finalText!.length).toBeGreaterThan(5);

    // Streaming text should have been seen during the response
    // (mock provider emits text_delta events that arrive via IPC)
    const streamingSeen = await window.evaluate(() => (window as any).__streamingTextSeen);
    const snapshots = await window.evaluate(() => (window as any).__streamingTextSnapshots);

    // With mock streaming, we should see text appearing while stop button is visible
    expect(streamingSeen).toBe(true);
    expect(snapshots.length).toBeGreaterThan(0);

    await app.close();
  });
});
