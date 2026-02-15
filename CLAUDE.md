# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turns Playwright tests into visual, step-by-step user tutorials by injecting Driver.js overlays at runtime. When tutorial mode is active, elements are spotlighted as the test executes; when inactive, all highlight calls are silent no-ops with zero overhead.

## Commands

```bash
# Install dependencies and browsers
npm install && npx playwright install

# Run tests normally (no highlights, fast)
npx playwright test --project=chromium

# Run with tutorial overlays (headed, slowMo)
TUTORIAL=1 npx playwright test --headed --project=chromium

# Run a specific test file
npx playwright test tests/todomvc.spec.ts --project=chromium

# View HTML report
npx playwright show-report
```

No npm scripts are defined — use `npx playwright test` directly. Module system is `commonjs`.

## Architecture

- **`lib/tutorial.ts`** — Core `Tutorial` class. Wraps a Playwright `Page`, lazily injects Driver.js v1.4.0 from CDN on first `highlight()` call. Constructor takes `(page, active=false)`. When `active` is `false`, `highlight()` is a no-op. Injection state auto-resets on `framenavigated`. Driver.js instances are stored/cleaned up on `window.__tutorialDriver`.

- **`lib/fixtures.ts`** — Extends Playwright's `test` with a `tutorial` boolean fixture option driven by `process.env.TUTORIAL`. Re-exports `expect`. Tests must import from here, not `@playwright/test`.

- **`playwright.config.ts`** — Typed with `TestOptions` from `lib/fixtures`. Sets `slowMo: 500` and video recording when `TUTORIAL` env var is set, viewport `1600×900` per project.

- **`tests/*.spec.ts`** — Test files that interleave `tutorial.highlight()` calls between standard Playwright actions.

**Data flow:** Test navigates → creates `Tutorial(page, active)` → `highlight()` either no-ops (inactive) or injects Driver.js, creates overlay, waits for timeout, destroys overlay → test continues.

## Conventions

- Import `test`/`expect` from `../lib/fixtures` (not `@playwright/test`) so the `tutorial` fixture option is available.
- One `Tutorial` instance per test, created right after `page.goto()`.
- Two activation modes: `new Tutorial(page, tutorialActive)` for env-var-driven, `new Tutorial(page, true)` for always-on.
- `highlight(target, options?)` accepts CSS selector strings or Playwright `Locator`s. Popover fields (`title`, `text`, `side`, `align`, `timeout`) are all optional.
- Driver.js is CDN-loaded (not an npm dependency). Version pinned in constants at top of `lib/tutorial.ts`.
- All browser-side code runs via `page.evaluate()` — keep it self-contained with no closures over Node variables.
- Preserve the lazy injection pattern (`_ensureDriverJs` with `_injected` flag) and the `framenavigated` listener when modifying the Tutorial class.
