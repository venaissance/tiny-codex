/**
 * Verify vite.config.ts has correct Tailwind plugin setup.
 * Prevents accidental removal of the @tailwindcss/vite plugin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const config = readFileSync(
  resolve(__dirname, '../../../vite.config.ts'),
  'utf-8',
);

describe('vite.config.ts', () => {
  it('imports @tailwindcss/vite plugin', () => {
    expect(config).toContain("from '@tailwindcss/vite'");
  });

  it('includes tailwindcss() in plugins array', () => {
    expect(config).toContain('tailwindcss()');
  });

  it('uses src/renderer as root', () => {
    expect(config).toMatch(/root:\s*['"]src\/renderer['"]/);
  });
});
