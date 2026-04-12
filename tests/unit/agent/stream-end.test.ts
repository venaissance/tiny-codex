/**
 * Regression: onStreamEnd handler must be able to access rafId/pendingText
 * variables defined in the same useEffect scope. Previously these were
 * scoped inside the onStreamDelta block, causing "rafId is not defined"
 * crash that prevented isStreaming from ever becoming false.
 */
import { describe, it, expect } from 'vitest';

// We test the fix structurally — verify the variables are at the right scope
// by importing and parsing the source file
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('useAgent stream variable scoping', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../src/renderer/hooks/useAgent.ts'),
    'utf-8',
  );

  it('pendingText is declared before onStreamDelta block, not inside it', () => {
    // pendingText must be declared BEFORE the `if (api.onStreamDelta)` block
    const pendingIdx = src.indexOf("let pendingText = ''");
    const deltaBlockIdx = src.indexOf('if (api.onStreamDelta)');
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(deltaBlockIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeLessThan(deltaBlockIdx);
  });

  it('rafId is declared before onStreamDelta block, not inside it', () => {
    const rafIdx = src.indexOf('let rafId');
    const deltaBlockIdx = src.indexOf('if (api.onStreamDelta)');
    expect(rafIdx).toBeGreaterThan(-1);
    expect(rafIdx).toBeLessThan(deltaBlockIdx);
  });

  it('onStreamEnd handler references rafId (confirms shared scope)', () => {
    const endBlock = src.slice(src.indexOf('if (api.onStreamEnd)'));
    expect(endBlock).toContain('rafId');
    expect(endBlock).toContain('pendingText');
  });
});
