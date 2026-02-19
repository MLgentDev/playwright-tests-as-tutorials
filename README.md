# playwright-tests-as-tutorials

Turn existing Playwright tests into interactive, in-app user tutorials using [Driver.js](https://driverjs.com/).

## Idea

Playwright tests already navigate your app and interact with real UI elements — the same steps a user would follow. This project injects [Driver.js](https://driverjs.com/) into the page at runtime to visually highlight elements as the test runs, turning automated tests into watchable, step-by-step tutorials.

## How It Works

1. A `Tutorial` utility class wraps a Playwright `Page` and accepts an `active` flag (default `false`)
2. When `active` is `false`, all `highlight()` calls are silent no-ops — zero overhead for normal test runs
3. When `active` is `true`, it lazily injects Driver.js (CSS + JS) from CDN into the page on first use
4. Calling `tutorial.highlight(target, options?)` overlays a spotlight on the target element with an optional popover, holds for a configurable duration (default: 3s), then auto-dismisses
5. `highlight()` can optionally speak text concurrently with the overlay (`speech` option), and `speak()` provides standalone narration without a visual highlight
6. Two TTS backends are available: Web Speech API (default, browser-side) and edge-tts (Microsoft neural voices, Node-side synthesis via `@andresaya/edge-tts`), selected via the `TTS` env var
7. With edge-tts + ffmpeg, audio chunks are merged into the recorded video after the test finishes, producing a narrated `video-narrated.webm`
8. Injection state resets automatically on page navigations

## Quick Start

```bash
npm install
npx playwright install

# Run tests normally (no highlights, fast)
npx playwright test --project=chromium

# Run with tutorial overlays enabled (Web Speech API, default)
TUTORIAL=1 npx playwright test --headed --project=chromium

# Run with Microsoft neural voices via edge-tts
TUTORIAL=1 TTS=edge-tts npx playwright test --headed --project=chromium

# Run a specific test file
npx playwright test tests/todomvc.spec.ts --headed --project=chromium

# Run a specific test file with tutorial overlays enabled
TUTORIAL=1 npx playwright test tests/todomvc.spec.ts --headed --project=chromium

# Run a specific test file with edge-tts neural voices
TUTORIAL=1 TTS=edge-tts npx playwright test tests/todomvc.spec.ts --headed --project=chromium
```

When `TUTORIAL=1` is set, video recording is automatically enabled via `playwright.config.ts`. Videos are saved in the `test-results/` directory alongside each test's artifacts and are also available in the HTML report (`npx playwright show-report`).

With `TUTORIAL=1`, the browser shows Driver.js highlights between test steps and actions are slowed with `slowMo: 500`. Without it, highlights are no-ops, video is off, and tests run at full speed.

With edge-tts (`TTS=edge-tts`), narrated videos with embedded audio are produced automatically. Requires `ffmpeg` on `PATH`. The narrated video (`video-narrated.webm`) is attached to the test report alongside the silent video.

## Usage

Import `test` and `expect` from `../lib/fixtures` (not `@playwright/test`) to get the `tutorial` fixture option. Use the `tutorialObj` fixture to get a pre-constructed `Tutorial` instance — it handles start-time tracking and automatic audio-video merge on teardown.

### Env-var-driven tutorial (highlights only when `TUTORIAL=1`)

```typescript
import { test, expect } from '../lib/fixtures';

test('example tutorial', async ({ page, tutorialObj: tutorial }) => {
  await page.goto('https://example.com');

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

test.use({ tutorial: true });

test('always-on demo', async ({ page, tutorialObj: tutorial }) => {
  await page.goto('https://example.com');
  await tutorial.highlight('.hero', { title: 'Hero', text: 'Always highlighted.' });
});
```

### Speech narration

```typescript
import { test, expect } from '../lib/fixtures';

test('speech demo', async ({ page, tutorialObj: tutorial }) => {
  await page.goto('https://example.com');

  // Speak while highlighting — speech runs concurrently with the overlay
  await tutorial.highlight('.hero-title', {
    title: 'Welcome',
    speech: 'This is the main heading of the page.',
  });

  // Standalone narration without a visual highlight
  await tutorial.speak('Now we will fill in the form.');

  // Narration with speech options
  await tutorial.speak('Almost done!', { rate: 0.8, pitch: 1.2, lang: 'en-US' });
});
```

## API

### `tutorialObj` fixture (recommended)

The `tutorialObj` fixture provides a pre-constructed `Tutorial` instance. It tracks the test start time for audio synchronization and, on teardown with edge-tts, automatically merges accumulated audio chunks into the recorded video via ffmpeg, producing `video-narrated.webm` attached to the test report.

```typescript
test('my tutorial', async ({ page, tutorialObj: tutorial }) => {
  // tutorial is ready to use — no manual construction needed
});
```

### `new Tutorial(page: Page, active?: boolean)`

Creates a tutorial instance bound to a Playwright `Page`. When `active` is `false` (default), all `highlight()` calls are silent no-ops. Automatically re-injects Driver.js after navigations.

> **Note:** Prefer the `tutorialObj` fixture over manual construction. It handles start-time tracking and audio-video merge on teardown.

### `tutorial.highlight(target: string | Locator, options?: HighlightOptions): Promise<void>`

- **target** — CSS selector string or Playwright `Locator` of the element to highlight
- **options** — Optional object:
  - `title` — popover heading (supports HTML)
  - `text` — popover body (supports HTML)
  - `timeout` — ms to display (default: `3000`)
  - `side` — `'top' | 'right' | 'bottom' | 'left'`
  - `align` — `'start' | 'center' | 'end'`
  - `speech` — text to speak concurrently with the highlight (uses the configured TTS backend)

When `active` is `false`, returns immediately. When `active` is `true`, shows a Driver.js overlay around the element, optionally with a popover, waits for both the timeout and speech (if any) to finish, then dismisses.

### `tutorial.speak(text: string, options?: SpeakOptions): Promise<void>`

Speaks the given text without showing a visual overlay. No-op when `active` is `false`.

- **text** — the text to speak
- **options** — Optional `SpeakOptions` object:
  - `rate` — speech rate, 0.1–10 (default: `1.0`)
  - `pitch` — speech pitch, 0–2 (default: `1.0`)
  - `lang` — BCP 47 language tag (e.g. `'en-US'`, `'fr-FR'`) — Web Speech API only
  - `voice` — edge-tts voice name (e.g. `'en-US-AriaNeural'`) — edge-tts only

Gracefully degrades: Web Speech API silently skips if no voices are available; edge-tts silently skips on any failure.

## Configuration

The viewport is set to **1600×900** per project in `playwright.config.ts`. When `TUTORIAL=1` is set:

- Actions are slowed with `slowMo: 500` for visual pacing (otherwise `slowMo` is `0`)
- Test timeout is extended to **5 minutes** to accommodate highlights and narration
- Chromium is launched with `--enable-speech-dispatcher` for Web Speech API support (skipped when `TTS=edge-tts`)
- Video recording is enabled

### TTS Backends

| `TTS` env var | Backend | Voices | Requirements |
|---|---|---|---|
| *(unset)* or `web-speech-api` | Web Speech API | Browser-provided (espeak-ng on Linux) | `--enable-speech-dispatcher` launch arg |
| `edge-tts` | `@andresaya/edge-tts` | Microsoft neural voices (e.g. `en-US-EmmaMultilingualNeural`) | Internet connection, `ffmpeg` for narrated video |

Speech gracefully degrades on failure — tutorials still work visually.

The config imports `TestOptions` from `lib/fixtures` and uses `defineConfig<TestOptions>()` to enable the `tutorial` fixture option.

Driver.js is loaded from CDN (pinned to v1.4.0):
- JS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js`
- CSS: `https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css`

## Project Structure

```
lib/
  tutorial.ts        # Tutorial class (Driver.js injection + highlight + speech, idle by default)
  fixtures.ts        # Custom Playwright fixtures (tutorial option + tutorialObj with auto merge)
  audio-merger.ts    # Merges audio chunks into recorded video via ffmpeg
tests/
  example.spec.ts    # Always-on demo tutorials (Playwright docs site)
  todomvc.spec.ts    # Env-var-driven tutorial (TodoMVC app)
playwright.config.ts # Playwright config (viewport, conditional slowMo)
```

## License

Apache License 2.0
