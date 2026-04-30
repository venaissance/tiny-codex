/**
 * Dedicated vitest config for E2E smoke tests that hit real model providers.
 * Run with:
 *   RUN_REAL_GLM=1 GLM_API_KEY=... \
 *     pnpm vitest run --config vitest.e2e.config.ts tests/e2e/review-real-glm.test.ts
 *
 * The default `vitest.config.ts` excludes `tests/e2e/**` because those tests
 * cost real money and require network. This config flips the include set so
 * only e2e tests run.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // Don't auto-skip e2e here.
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
