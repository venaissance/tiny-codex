/**
 * Computational Sensor: Streamdown CSS compilation integrity.
 *
 * Uses the Tailwind v4 compiler directly (no vite build needed) to verify that
 * ALL classes declared in StreamdownSafelist.tsx compile into valid CSS.
 * Catches regressions from: @theme changes, Tailwind upgrades, safelist drift.
 *
 * This test runs in <500ms — safe for pre-commit hooks.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Extract className values from the safelist file
function extractSafelistClasses(): string[] {
  const safelist = fs.readFileSync(
    path.resolve(__dirname, '../../../src/renderer/StreamdownSafelist.tsx'),
    'utf8',
  );
  const classes = new Set<string>();
  const matches = safelist.match(/className="([^"]+)"/g) ?? [];
  for (const m of matches) {
    const inner = m.slice('className="'.length, -1);
    inner.split(/\s+/).forEach((cls) => cls && classes.add(cls));
  }
  return [...classes];
}

// Compile styles.css through Tailwind v4 and return the CSS output
async function compileTailwindCSS(candidates: string[]): Promise<string> {
  // Dynamic import — @tailwindcss/node is ESM
  const { compile } = await import('@tailwindcss/node');
  const cssPath = path.resolve(__dirname, '../../../src/renderer/styles.css');
  const cssSource = fs.readFileSync(cssPath, 'utf8');

  const compiler = await compile(cssSource, {
    from: cssPath,
    base: path.dirname(cssPath),
    onDependency: () => {},
  });

  return compiler.build(candidates);
}

// Check if a class name exists in the compiled CSS output
function classExistsInCSS(cls: string, css: string): boolean {
  // Tailwind escapes special chars: hover:bg-muted → .hover\:bg-muted
  // bg-muted/80 → .bg-muted\/80, p-1.5 → .p-1\.5
  const escaped = cls
    .replace(/\//g, '\\/')
    .replace(/\./g, '\\.')
    .replace(/:/g, '\\:');
  return css.includes('.' + escaped);
}

describe('Streamdown CSS compilation sensor', () => {
  it('all safelist classes compile into valid CSS', async () => {
    const classes = extractSafelistClasses();
    expect(classes.length).toBeGreaterThan(100); // sanity check — safelist not empty

    const css = await compileTailwindCSS(classes);
    expect(css.length).toBeGreaterThan(5000); // sanity check — CSS not empty

    const missing = classes.filter((c) => !classExistsInCSS(c, css));

    expect(missing).toEqual(
      // If this fails, add missing --color-* to @theme inline in styles.css,
      // or the class syntax isn't supported by Tailwind v4.
      [],
    );
  });
});
