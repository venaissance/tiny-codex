/**
 * CSS regression tests — verify key structural properties in styles.css
 * that have been accidentally broken before.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(
  resolve(__dirname, '../../../src/renderer/styles.css'),
  'utf-8',
);

describe('styles.css structural integrity', () => {
  it('sidebar has overflow-y: auto for scrolling', () => {
    const sidebarBlock = extractBlock(css, '.sidebar {');
    expect(sidebarBlock).toContain('overflow-y: auto');
  });

  it('sidebar has hidden scrollbar (scrollbar-width: none)', () => {
    const sidebarBlock = extractBlock(css, '.sidebar {');
    expect(sidebarBlock).toContain('scrollbar-width: none');
  });

  it('sidebar scrollbar pseudo-element only has display: none', () => {
    const pseudoBlock = extractBlock(css, '.sidebar::-webkit-scrollbar {');
    expect(pseudoBlock).toContain('display: none');
    // Must NOT contain sidebar layout properties
    expect(pseudoBlock).not.toContain('flex-shrink');
    expect(pseudoBlock).not.toContain('padding');
    expect(pseudoBlock).not.toContain('gap');
  });

  it('sidebar retains layout properties (flex-shrink, padding, gap)', () => {
    const sidebarBlock = extractBlock(css, '.sidebar {');
    expect(sidebarBlock).toContain('flex-shrink: 0');
    expect(sidebarBlock).toContain('padding: 12px');
    expect(sidebarBlock).toContain('gap: 4px');
  });

  it('@source inline includes key Streamdown Tailwind classes', () => {
    expect(css).toContain('@source inline(');
    // Critical classes that Streamdown needs
    const inlineLine = css.match(/@source inline\("([^"]+)"\)/)?.[1] ?? '';
    const requiredClasses = [
      'rounded-xl', 'rounded-lg', 'bg-sidebar', 'border-border',
      'flex-col', 'gap-2', 'items-center', 'justify-end',
      'font-mono', 'text-muted-foreground', 'h-8', 'opacity-0',
      'group-hover:opacity-100', 'overflow-x-auto', 'divide-y',
    ];
    for (const cls of requiredClasses) {
      expect(inlineLine, `Missing Tailwind class: ${cls}`).toContain(cls);
    }
  });

  it('@theme inline maps CSS variables for Streamdown', () => {
    expect(css).toContain('@theme inline');
    expect(css).toContain('--color-border: var(--border)');
    expect(css).toContain('--color-background: var(--background)');
    expect(css).toContain('--color-foreground: var(--foreground)');
    expect(css).toContain('--color-sidebar: var(--sidebar)');
    expect(css).toContain('--color-muted-foreground: var(--muted-foreground)');
    expect(css).toContain('--color-primary: var(--accent)');
    expect(css).toContain('--color-primary-foreground: var(--accent-fg)');
  });

  it(':root defines Tailwind-compatible alias variables', () => {
    const rootBlock = extractBlock(css, ':root {');
    expect(rootBlock).toContain('--background:');
    expect(rootBlock).toContain('--foreground:');
    expect(rootBlock).toContain('--sidebar:');
    expect(rootBlock).toContain('--muted-foreground:');
    expect(rootBlock).toContain('--border:');
  });

  it('[data-theme="light"] overrides all alias variables', () => {
    const lightBlock = extractBlock(css, '[data-theme="light"]');
    expect(lightBlock).toContain('--background:');
    expect(lightBlock).toContain('--foreground:');
    expect(lightBlock).toContain('--sidebar:');
    expect(lightBlock).toContain('--muted-foreground:');
    expect(lightBlock).toContain('--border:');
  });

  it('@custom-variant dark uses data-theme attribute', () => {
    expect(css).toContain('@custom-variant dark');
    expect(css).toContain('data-theme="dark"');
  });

  it('KaTeX inherits color for dark mode visibility', () => {
    expect(css).toContain('.katex');
    expect(css).toContain('color: inherit');
  });

  it('Tailwind v4 import is present', () => {
    expect(css).toContain('@import "tailwindcss"');
  });
});

/** Extract a CSS block starting from a selector */
function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return '';
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return css.slice(start, end);
}
