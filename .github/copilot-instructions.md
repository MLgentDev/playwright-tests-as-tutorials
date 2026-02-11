# Copilot Instructions — playwright-tests-as-tutorials

## Project Purpose

This project turns Playwright tests into visual, step-by-step user tutorials by injecting [Driver.js](https://driverjs.com/) overlays at runtime. Tests run in headed mode and visually spotlight UI elements as they execute.

## Architecture

- **`lib/tutorial.ts`** — Core `Tutorial` class. Wraps a Playwright `Page`, lazily injects Driver.js (v1.4.0) from CDN, exposes `highlight(target, options?)` where `target` is a CSS selector string or Playwright `Locator` and `options` is an optional `HighlightOptions` object with `title`, `text`, `timeout`, `side`, and `align`. Constructor takes `active: boolean = false` — when `false`, all `highlight()` calls are silent no-ops. Injection state auto-resets on `framenavigated`.
- **`lib/fixtures.ts`** — Extends Playwright's `test` with a `tutorial` boolean fixture option (default `false`). Reads `process.env.TUTORIAL` to set the value. Re-exports `expect`.
- **`tests/*.spec.ts`** — Playwright test files that import `test`/`expect` from `../lib/fixtures` and `Tutorial` from `../lib/tutorial`, then call `highlight()` between standard test steps.
- **`playwright.config.ts`** — Typed with `TestOptions` from `lib/fixtures`. Sets `slowMo` conditionally (`500` when `TUTORIAL` env var is set, `0` otherwise), viewport `1600×900` per project, `fullyParallel: true`.

Data flow: Test navigates page → creates `Tutorial(page, active)` → if `active` is `false`, `highlight()` returns immediately (no-op) → if `active` is `true`, `Tutorial` injects Driver.js if needed → `highlight()` waits for element visibility → creates Driver.js overlay → holds for timeout → destroys overlay → test continues.

## Key Commands

```bash
# Install deps + browsers
npm install && npx playwright install

# Run tests normally (no highlights, no slowMo — fast CI-friendly)
npx playwright test --project=chromium

# Run with tutorial overlays enabled (headed + slowMo)
TUTORIAL=1 npx playwright test --headed --project=chromium

# Run a specific test file
npx playwright test tests/todomvc.spec.ts --project=chromium

# Run all browser projects with tutorials
TUTORIAL=1 npx playwright test --headed

# View HTML report after a run
npx playwright show-report
```

Use `--headed` when you want to see the tutorial overlays. Set `TUTORIAL=1` to activate env-var-driven tutorials. Tests that hard-code `new Tutorial(page, true)` always show highlights regardless of the env var.

## Writing New Tutorials

1. Create a test file in `tests/`.
2. Import `test`/`expect` from `../lib/fixtures` (not `@playwright/test`) and `Tutorial` from `../lib/tutorial`.
3. Destructure `{ page, tutorial: tutorialActive }` from the test fixture.
4. Instantiate with `new Tutorial(page, tutorialActive)` — highlights activate only when `TUTORIAL=1` is set.
5. Interleave `await tutorial.highlight(target, options?)` calls between test actions to spotlight elements.
6. `highlight()` accepts a CSS selector string or a Playwright `Locator`. Pass an optional `HighlightOptions` object to control popover content, duration, and positioning.
7. When tutorial mode is off, `highlight()` is a silent no-op — tests run at full speed with zero overhead.

To create an **always-on** tutorial (highlights every run), pass `true` directly: `new Tutorial(page, true)`.

`HighlightOptions` fields (all optional):
- `title` — popover heading (supports HTML)
- `text` — popover body (supports HTML)
- `timeout` — ms to display (default 3000)
- `side` — `'top' | 'right' | 'bottom' | 'left'`
- `align` — `'start' | 'center' | 'end'`

Example — env-var-driven tutorial (from `tests/todomvc.spec.ts`):
```typescript
import { test, expect } from '../lib/fixtures';
import { Tutorial } from '../lib/tutorial';

test('my tutorial', async ({ page, tutorial: tutorialActive }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page, tutorialActive);
  await tutorial.highlight('.target-element');                                                // overlay only, 3s
  await tutorial.highlight('#cta-button', { title: 'Click here', text: 'Start the flow' });  // with popover
  await tutorial.highlight('#cta-button', { timeout: 5000 });                                // overlay only, 5s
  await tutorial.highlight('.hero', { title: 'Hero', side: 'bottom', align: 'center' });     // positioned popover
  await page.getByRole('link', { name: 'Next' }).click();
  await tutorial.highlight(page.getByRole('heading', { name: 'Result' }), {
    text: 'This is the result heading',
  }); // Locator with popover
});
```

Example — always-on tutorial (from `tests/example.spec.ts`):
```typescript
import { test, expect } from '../lib/fixtures';
import { Tutorial } from '../lib/tutorial';

test('always-on demo', async ({ page }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page, true); // always active
  await tutorial.highlight('.hero', { title: 'Hero', text: 'Always highlighted.' });
});
```

## Conventions

- **One `Tutorial` instance per test** — create it right after `page.goto()`.
- **Two activation modes**: pass `tutorialActive` fixture value for env-var-driven activation, or pass `true` for always-on demos.
- **Import from `../lib/fixtures`** — not from `@playwright/test` directly — so the `tutorial` fixture option is available.
- **Popover is optional** — omit `title`/`text` for overlay-only highlights; provide them to show a Driver.js popover.
- **Driver.js is CDN-loaded**, not an npm dependency. Version is pinned via constants at the top of `lib/tutorial.ts`.
- **No npm scripts defined** — run Playwright directly via `npx playwright test`.
- **Module system**: `commonjs` (see `package.json` `"type"`).
- **`TUTORIAL=1`** — set this env var to enable tutorial highlights and `slowMo: 500`. Without it, highlights are no-ops and `slowMo` is `0`.

## Extending the Tutorial Class

When modifying `lib/tutorial.ts`:
- Keep the lazy injection pattern (`_ensureDriverJs` guard via `_injected` flag).
- Preserve the `framenavigated` listener that resets `_injected` on main-frame navigation.
- Store/cleanup any Driver.js instances on `window.__tutorialDriver` to avoid overlay leaks.
- All browser-side code runs via `page.evaluate()` — keep it self-contained (no closures over Node variables).
