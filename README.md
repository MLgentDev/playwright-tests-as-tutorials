# playwright-tests-as-tutorials

Turn existing Playwright tests into interactive, in-app user tutorials using [Driver.js](https://driverjs.com/).

## Idea

Playwright tests already navigate your app and interact with real UI elements — the same steps a user would follow. This project injects [Driver.js](https://driverjs.com/) into the page at runtime to visually highlight elements as the test runs, turning automated tests into watchable, step-by-step tutorials.

## How It Works

1. A `Tutorial` utility class wraps a Playwright `Page`
2. On first use, it lazily injects Driver.js (CSS + JS) from CDN into the page
3. Calling `tutorial.highlight(selector)` overlays a spotlight on the target element for a configurable duration (default: 3s), then auto-dismisses
4. Injection state resets automatically on page navigations

## Quick Start

```bash
npm install
npx playwright install
npx playwright test --headed --project=chromium
```

Watch the browser — you'll see Driver.js highlights appear between test steps.

## Usage

```typescript
import { test, expect } from '@playwright/test';
import { Tutorial } from '../lib/tutorial';

test('example tutorial', async ({ page }) => {
  await page.goto('https://example.com');
  const tutorial = new Tutorial(page);

  // Highlight an element for 3 seconds (default)
  await tutorial.highlight('.hero-title');

  // Highlight with custom timeout
  await tutorial.highlight('#signup-button', 5000);
});
```

## API

### `new Tutorial(page: Page)`

Creates a tutorial instance bound to a Playwright `Page`. Automatically re-injects Driver.js after navigations.

### `tutorial.highlight(selector: string, timeout?: number): Promise<void>`

- **selector** — CSS selector of the element to highlight
- **timeout** — Duration in ms to hold the highlight (default: `3000`)

Shows a Driver.js overlay cutout around the element, waits for the timeout, then dismisses.

## Configuration

The viewport is set to **1600×900** per project in `playwright.config.ts`. Actions are slowed down with `slowMo: 500` for better visual pacing during demos.

Driver.js is loaded from CDN (pinned to v1.4.0):
- JS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js`
- CSS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css`

## Project Structure

```
lib/
  tutorial.ts        # Tutorial utility class (Driver.js injection + highlight)
tests/
  example.spec.ts    # Demo test with highlight calls
playwright.config.ts # Playwright config (viewport, slowMo)
```

## License

ISC
