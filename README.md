# playwright-tests-as-tutorials

Turn existing Playwright tests into interactive, in-app user tutorials using [Driver.js](https://driverjs.com/).

## Idea

Playwright tests already navigate your app and interact with real UI elements — the same steps a user would follow. This project injects [Driver.js](https://driverjs.com/) into the page at runtime to visually highlight elements as the test runs, turning automated tests into watchable, step-by-step tutorials.

## How It Works

1. A `Tutorial` utility class wraps a Playwright `Page` and accepts an `active` flag (default `false`)
2. When `active` is `false`, all `highlight()` calls are silent no-ops — zero overhead for normal test runs
3. When `active` is `true`, it lazily injects Driver.js (CSS + JS) from CDN into the page on first use
4. Calling `tutorial.highlight(target, options?)` overlays a spotlight on the target element with an optional popover, holds for a configurable duration (default: 3s), then auto-dismisses
5. Injection state resets automatically on page navigations

## Quick Start

```bash
npm install
npx playwright install

# Run tests normally (no highlights, fast)
npx playwright test --project=chromium

# Run with tutorial overlays enabled
TUTORIAL=1 npx playwright test --headed --project=chromium

# Run a specific test file
npx playwright test tests/todomvc.spec.ts --headed --project=chromium

# Run a specific test file with tutorial overlays enabled
TUTORIAL=1 npx playwright test tests/todomvc.spec.ts --headed --project=chromium
```

With `TUTORIAL=1`, the browser shows Driver.js highlights between test steps and actions are slowed with `slowMo: 500`. Without it, highlights are no-ops and tests run at full speed.

## Usage

Import `test` and `expect` from `../lib/fixtures` (not `@playwright/test`) to get the `tutorial` fixture option.

### Env-var-driven tutorial (highlights only when `TUTORIAL=1`)

```typescript
import { test, expect } from '../lib/fixtures';
import { Tutorial } from '../lib/tutorial';

test('example tutorial', async ({ page, tutorial: tutorialActive }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page, tutorialActive);

  await tutorial.highlight('.hero-title');                                     // overlay only, 3s
  await tutorial.highlight('#signup-button', { title: 'Sign Up', text: 'Click here to register.' });
  await tutorial.highlight('.hero', { timeout: 5000, side: 'bottom' });       // positioned, 5s
  await tutorial.highlight(page.getByRole('heading', { name: 'Welcome' }), {
    text: 'Locator-based highlight',
  });
});
```

### Always-on tutorial (highlights every run)

```typescript
import { test, expect } from '../lib/fixtures';
import { Tutorial } from '../lib/tutorial';

test('always-on demo', async ({ page }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page, true); // always active
  await tutorial.highlight('.hero', { title: 'Hero', text: 'Always highlighted.' });
});
```

## API

### `new Tutorial(page: Page, active?: boolean)`

Creates a tutorial instance bound to a Playwright `Page`. When `active` is `false` (default), all `highlight()` calls are silent no-ops. Automatically re-injects Driver.js after navigations.

### `tutorial.highlight(target: string | Locator, options?: HighlightOptions): Promise<void>`

- **target** — CSS selector string or Playwright `Locator` of the element to highlight
- **options** — Optional object:
  - `title` — popover heading (supports HTML)
  - `text` — popover body (supports HTML)
  - `timeout` — ms to display (default: `3000`)
  - `side` — `'top' | 'right' | 'bottom' | 'left'`
  - `align` — `'start' | 'center' | 'end'`

When `active` is `false`, returns immediately. When `active` is `true`, shows a Driver.js overlay around the element, optionally with a popover, waits for the timeout, then dismisses.

## Configuration

The viewport is set to **1600×900** per project in `playwright.config.ts`. When `TUTORIAL=1` is set, actions are slowed with `slowMo: 500` for visual pacing; otherwise `slowMo` is `0`.

The config imports `TestOptions` from `lib/fixtures` and uses `defineConfig<TestOptions>()` to enable the `tutorial` fixture option.

Driver.js is loaded from CDN (pinned to v1.4.0):
- JS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js`
- CSS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css`

## Project Structure

```
lib/
  tutorial.ts        # Tutorial class (Driver.js injection + highlight, idle by default)
  fixtures.ts        # Custom Playwright fixtures (tutorial boolean option)
tests/
  example.spec.ts    # Always-on demo tutorials (Playwright docs site)
  todomvc.spec.ts    # Env-var-driven tutorial (TodoMVC app)
playwright.config.ts # Playwright config (viewport, conditional slowMo)
```

## License

ISC
