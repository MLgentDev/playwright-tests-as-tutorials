# Copilot Instructions — playwright-tests-as-tutorials

## Project Purpose

This project turns Playwright tests into visual, step-by-step user tutorials by injecting [Driver.js](https://driverjs.com/) overlays at runtime. Tests run in headed mode and visually spotlight UI elements as they execute.

## Architecture

- **`lib/tutorial.ts`** — Core `Tutorial` class. Wraps a Playwright `Page`, lazily injects Driver.js (v1.4.0) from CDN, exposes `highlight(selector, timeout?)`. Injection state auto-resets on `framenavigated`.
- **`tests/*.spec.ts`** — Playwright test files that import `Tutorial` and call `highlight()` between standard test steps.
- **`playwright.config.ts`** — Sets `slowMo: 500` for demo pacing, viewport `1600×900` per project, `fullyParallel: true`.

Data flow: Test navigates page → `Tutorial` injects Driver.js if needed → `highlight()` waits for element visibility → creates Driver.js overlay → holds for timeout → destroys overlay → test continues.

## Key Commands

```bash
# Install deps + browsers
npm install && npx playwright install

# Run tutorials visually (the primary workflow)
npx playwright test --headed --project=chromium

# Run all browser projects
npx playwright test --headed

# View HTML report after a run
npx playwright show-report
```

Always use `--headed` — headless runs won't show the tutorial overlays.

## Writing New Tutorials

1. Create a test file in `tests/` using Playwright's `test`/`expect` from `@playwright/test`.
2. Import `Tutorial` from `../lib/tutorial` and instantiate with `new Tutorial(page)`.
3. Interleave `await tutorial.highlight(selector)` calls between test actions to spotlight elements.
4. Use CSS selectors for `highlight()`. Default duration is 3000ms; pass a second arg to customize.

Example pattern (from `tests/example.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';
import { Tutorial } from '../lib/tutorial';

test('my tutorial', async ({ page }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page);
  await tutorial.highlight('.target-element');      // 3s default
  await tutorial.highlight('#cta-button', 5000);   // 5s custom
  await page.getByRole('link', { name: 'Next' }).click();
  await tutorial.highlight('header h1');
});
```

## Conventions

- **One `Tutorial` instance per test** — create it right after `page.goto()`.
- **No popover text** — highlights use overlay-only mode (`popoverClass: 'tutorial-no-popover'`). If adding popover support, extend the `highlight()` API in `lib/tutorial.ts`.
- **Driver.js is CDN-loaded**, not an npm dependency. Version is pinned via constants at the top of `lib/tutorial.ts`.
- **No npm scripts defined** — run Playwright directly via `npx playwright test`.
- **Module system**: `commonjs` (see `package.json` `"type"`).

## Extending the Tutorial Class

When modifying `lib/tutorial.ts`:
- Keep the lazy injection pattern (`_ensureDriverJs` guard via `_injected` flag).
- Preserve the `framenavigated` listener that resets `_injected` on main-frame navigation.
- Store/cleanup any Driver.js instances on `window.__tutorialDriver` to avoid overlay leaks.
- All browser-side code runs via `page.evaluate()` — keep it self-contained (no closures over Node variables).
