# Tailwind v4 Vite Dev Mode — Utilities Not Compiling

## Symptom
Streamdown markdown preview completely unstyled — no backgrounds, borders, heading sizes, spacing. Code syntax highlighting worked (Shiki uses inline styles).

## Root Cause
`@tailwindcss/vite` plugin v4.2.2 in serve mode (vite dev) leaves `@tailwind utilities` as an unprocessed placeholder. The oxide scanner finds 0 utility candidates because:
1. Our React components use custom CSS classes (`.panel`, `.sidebar`), not Tailwind utilities
2. Streamdown's classes are in node_modules, which the scanner skips
3. `@source inline()` and `@source "path"` directives are ignored in dev mode

## Fix
1. **dev.sh**: `vite build --watch` instead of `vite dev` — build mode fully compiles utilities
2. **window.ts**: Always `loadFile()`, never connect to dev server
3. **StreamdownSafelist.tsx**: JSX file declaring all ~170 Streamdown Tailwind classes via `className` attributes — ensures the oxide scanner finds them during build
4. **@theme inline**: Added `--color-muted: var(--surface-hover)` for `bg-muted` compilation
5. **Computational Sensor**: `tests/unit/renderer/streamdown-css-sensor.test.ts` — vitest test that compiles styles.css through Tailwind and verifies all 169 safelist classes exist in output. Runs in 335ms. Catches regressions from theme changes, Tailwind upgrades, or safelist drift.

## Prevention
- CSS sensor test runs in `npm test` → pre-commit hook → CI
- Three-layer defense: dev time + commit time + CI

## Key Files
- `src/renderer/StreamdownSafelist.tsx`
- `src/renderer/styles.css` (@theme inline block)
- `scripts/dev.sh`
- `src/main/window.ts`
- `tests/unit/renderer/streamdown-css-sensor.test.ts`
