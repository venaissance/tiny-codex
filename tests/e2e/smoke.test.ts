/**
 * Smoke Test — One launch, all core flows.
 *
 * Uses E2E_MOCK=1 for instant LLM responses (no real API needed).
 * This single test represents the full E2E coverage:
 *   - App launch & window
 *   - Welcome screen & quick cards
 *   - Thread creation (button + auto-create)
 *   - Model picker & mode picker
 *   - Sending messages → agent response with tool use
 *   - Progress to-do list (thinking → tool → done)
 *   - Preview panel (visible, toggle, tabs)
 *   - Keyboard shortcuts (Cmd+N, Cmd+\)
 *   - Sidebar scrollable
 *   - @ file picker, / command picker
 *   - Theme attribute present
 */
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

const mainPath = path.resolve(__dirname, '../../dist/main/main/index.js');

test.describe('Smoke Test (Mock LLM)', () => {
  test('full app lifecycle', async () => {
    const app = await electron.launch({
      args: [mainPath],
      env: { ...process.env, E2E_MOCK: '1' },
    });
    const window = await app.firstWindow();

    // ─── 1. App Launch ───
    const title = await window.title();
    expect(title).toContain('tiny-codex');

    // ─── 2. Welcome Screen ───
    await expect(window.locator("text=Let's build")).toBeVisible({ timeout: 5000 });
    await expect(window.locator('textarea[placeholder*="Ask anything"]')).toBeVisible();

    // ─── 3. Theme ───
    const theme = await window.locator('html').getAttribute('data-theme');
    expect(theme).toBeTruthy();

    // ─── 4. Sidebar elements ───
    await expect(window.locator('text=+ New thread')).toBeVisible();
    await expect(window.locator('text=Image Gen')).toBeVisible();

    // Sidebar should be scrollable (overflow-y: auto)
    const sidebarOverflow = await window.locator('.sidebar').evaluate(
      el => getComputedStyle(el).overflowY,
    );
    expect(sidebarOverflow).toBe('auto');

    // ─── 5. Quick Card → creates thread ───
    await window.locator('button:has-text("Create a React page")').click();
    await expect(window.locator('[data-active="true"]')).toBeVisible({ timeout: 5000 });

    // Wait for mock agent to respond
    await window.locator('.stop-btn').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await window.locator('.stop-btn').waitFor({ state: 'hidden', timeout: 30_000 });
    await window.waitForTimeout(300);

    // User message should be in chat
    await expect(window.locator('text=Create a React page').first()).toBeVisible();

    // Agent response should be visible (mock response)
    const chatContent = await window.locator('.chat-messages').textContent();
    expect(chatContent!.length).toBeGreaterThan(10);

    // ─── 6. Progress shows Done ───
    const progressSteps = window.locator('.sidebar-progress-step');
    await expect(progressSteps.first()).toBeVisible({ timeout: 5000 });
    const doneStep = window.locator('.sidebar-progress-step', { hasText: 'Done' });
    await expect(doneStep).toBeVisible({ timeout: 5000 });

    // ─── 7. Cmd+N → new thread ───
    await window.keyboard.press('Meta+n');
    await window.waitForTimeout(500);

    // ─── 8. Model Picker ───
    const modelPicker = window.locator('text=MiniMax-M2.7').first();
    await expect(modelPicker).toBeVisible();
    await modelPicker.click();
    await expect(window.locator('text=glm-5.1').first()).toBeVisible({ timeout: 3000 });
    // Close by clicking elsewhere
    await window.locator('.input-area').click();

    // ─── 9. Mode Picker ───
    const worktreeBtn = window.locator('text=Worktree').first();
    await expect(worktreeBtn).toBeVisible();
    await worktreeBtn.click();
    const activeMode = window.locator('.mode-btn.active');
    await expect(activeMode).toHaveText('Worktree');
    // Switch back
    await window.locator('text=Local').first().click();

    // ─── 10. Send message with tool use → progress shows tool steps ───
    const input = window.locator('textarea[placeholder*="Ask anything"]');
    await input.fill('Use bash to run "echo smoke-test"');
    await input.press('Enter');

    // Wait for mock agent to finish (fast with mock)
    await window.locator('.stop-btn').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await window.locator('.stop-btn').waitFor({ state: 'hidden', timeout: 30_000 });
    await window.waitForTimeout(300);

    // Progress should show completed bash step with line-through
    const bashStep = window.locator('.sidebar-progress-step', { hasText: 'bash' });
    await expect(bashStep).toBeVisible({ timeout: 5000 });
    const bashStyle = await bashStep.getAttribute('style');
    expect(bashStyle).toContain('line-through');

    // Progress should show Done
    const doneStep2 = window.locator('.sidebar-progress-step', { hasText: 'Done' });
    await expect(doneStep2).toBeVisible({ timeout: 5000 });

    // ─── 11. Preview Panel ───
    const previewPanel = window.locator('.preview-panel');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    // Toggle off with Cmd+\
    await window.keyboard.press('Meta+\\');
    await expect(previewPanel).not.toBeVisible({ timeout: 3000 });

    // Toggle back on
    await window.keyboard.press('Meta+\\');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });

    // Preview tabs
    await expect(window.locator('.preview-panel >> text=Preview')).toBeVisible();
    await expect(window.locator('.preview-panel >> text=Code')).toBeVisible();

    // ─── 12. @ File Picker ───
    await input.fill('@');
    const filePicker = window.locator('.skill-picker').first();
    await expect(filePicker).toBeVisible({ timeout: 3000 });
    await input.press('Escape');

    // ─── 13. / Command Picker ───
    await input.fill('/');
    const cmdPicker = window.locator('.skill-picker').first();
    await expect(cmdPicker).toBeVisible({ timeout: 3000 });
    await expect(cmdPicker.locator('text=Image Gen')).toBeVisible();

    // Select skill → tag appears
    await cmdPicker.locator('text=Image Gen').click();
    const skillTag = window.locator('.skill-tag').first();
    await expect(skillTag).toBeVisible({ timeout: 3000 });
    await expect(skillTag).toContainText('Image Gen');

    // ─── 14. Open / Commit buttons ───
    await expect(window.locator('button >> text=Open')).toBeVisible();
    await expect(window.locator('button >> text=Commit')).toBeVisible();

    // ─── 15. Style regression guards ───

    // Sidebar scrollbar should be hidden
    const sidebarScrollbar = await window.locator('.sidebar').evaluate(
      el => getComputedStyle(el).scrollbarWidth,
    );
    expect(sidebarScrollbar).toBe('none');

    // Verify Tailwind CSS classes needed by Streamdown are compiled
    const hasTailwindClasses = await window.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let cssText = '';
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) { cssText += rule.cssText + ' '; }
        } catch { /* cross-origin sheets */ }
      }
      return {
        // Streamdown layout classes
        roundedLg: cssText.includes('rounded-lg'),
        roundedXl: cssText.includes('rounded-xl'),
        bgSidebar: cssText.includes('bg-sidebar'),
        borderBorder: cssText.includes('border-border'),
        flexCol: cssText.includes('flex-col'),
        textMutedForeground: cssText.includes('text-muted-foreground'),
        // Code block classes
        fontMono: cssText.includes('font-mono'),
        overflowXAuto: cssText.includes('overflow-x-auto'),
        justifyEnd: cssText.includes('justify-end'),
        // Interactive classes
        groupHover: cssText.includes('group-hover'),
        opacity0: cssText.includes('opacity-0') || cssText.includes('opacity: 0'),
      };
    });
    expect(hasTailwindClasses.roundedLg).toBe(true);
    expect(hasTailwindClasses.roundedXl).toBe(true);
    expect(hasTailwindClasses.bgSidebar).toBe(true);
    expect(hasTailwindClasses.borderBorder).toBe(true);
    expect(hasTailwindClasses.flexCol).toBe(true);
    expect(hasTailwindClasses.textMutedForeground).toBe(true);
    expect(hasTailwindClasses.fontMono).toBe(true);
    expect(hasTailwindClasses.overflowXAuto).toBe(true);
    expect(hasTailwindClasses.justifyEnd).toBe(true);

    // Verify CSS custom properties are defined (theme variables)
    const cssVars = await window.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        border: style.getPropertyValue('--border').trim(),
        background: style.getPropertyValue('--background').trim(),
        sidebar: style.getPropertyValue('--sidebar').trim(),
        mutedForeground: style.getPropertyValue('--muted-foreground').trim(),
        accent: style.getPropertyValue('--accent').trim(),
      };
    });
    // All theme variables must be defined (non-empty)
    expect(cssVars.border).toBeTruthy();
    expect(cssVars.background).toBeTruthy();
    expect(cssVars.sidebar).toBeTruthy();
    expect(cssVars.mutedForeground).toBeTruthy();
    expect(cssVars.accent).toBeTruthy();

    // Verify Shiki hand-written CSS rules exist (not via @source inline)
    const hasShikiCSS = await window.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let cssText = '';
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) { cssText += rule.cssText + ' '; }
        } catch {}
      }
      return {
        sdmColor: cssText.includes('--sdm-c'),
        sdmBg: cssText.includes('--sdm-tbg'),
        shikiDark: cssText.includes('--shiki-dark'),
        counterLine: cssText.includes('counter(line)'),
      };
    });
    expect(hasShikiCSS.sdmColor).toBe(true);
    expect(hasShikiCSS.sdmBg).toBe(true);
    expect(hasShikiCSS.shikiDark).toBe(true);
    expect(hasShikiCSS.counterLine).toBe(true);

    // Verify KaTeX color inherit rule is applied
    const katexInherit = await window.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.katex')) {
              return rule.style.color;
            }
          }
        } catch {}
      }
      return null;
    });
    expect(katexInherit).toBe('inherit');

    // ─── 16. Markdown preview renders with Streamdown styles ───
    // Click a .md file in sidebar to trigger preview
    const mdFile = window.locator('.sidebar-item', { hasText: 'aa.md' });
    if (await mdFile.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mdFile.click();
      await window.waitForTimeout(1000);
      // Preview panel should show content (not blank)
      const previewContent = await previewPanel.textContent();
      expect(previewContent!.length).toBeGreaterThan(20);
    }

    // ─── 17. HTML preview renders (not blank) ───
    const htmlFile = window.locator('.sidebar-item', { hasText: 'todo.html' });
    if (await htmlFile.isVisible({ timeout: 2000 }).catch(() => false)) {
      await htmlFile.click();
      await window.waitForTimeout(1000);
      // Preview should have an iframe with content
      const iframe = previewPanel.locator('iframe');
      await expect(iframe).toBeVisible({ timeout: 3000 });
    }

    // ─── Done ───
    await app.close();
  });
});
