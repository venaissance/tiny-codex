import type { Page } from '@playwright/test';

/**
 * Wait for the agent to finish streaming.
 * Uses the stop button (■) visibility as the signal —
 * it appears when streaming starts and disappears when done.
 */
export async function waitForAgentComplete(window: Page, timeoutMs = 120_000) {
  // Wait for streaming to start (stop button appears)
  await window.locator('.stop-btn').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

  // Wait for streaming to end (stop button disappears)
  await window.locator('.stop-btn').waitFor({ state: 'hidden', timeout: timeoutMs });

  // Grace period for final DOM updates
  await window.waitForTimeout(500);
}
