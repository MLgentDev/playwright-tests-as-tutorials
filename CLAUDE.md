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

# Run with tutorial overlays (headed, slowMo, Web Speech API)
TUTORIAL=1 npx playwright test --headed --project=chromium

# Run with Microsoft neural voices via edge-tts (requires ffmpeg for narrated video output)
TUTORIAL=1 TTS=edge-tts npx playwright test --headed --project=chromium

# Run a specific test file
npx playwright test tests/todomvc.spec.ts --project=chromium

# View HTML report
npx playwright show-report
```

No npm scripts are defined — use `npx playwright test` directly. Module system is `commonjs`.

## Architecture

- **`lib/tutorial.ts`** — Core `Tutorial` class. Wraps a Playwright `Page`, lazily injects Driver.js v1.4.0 from CDN on first `highlight()` call. Constructor takes `(page, active=false)`. When `active` is `false`, `highlight()` and `speak()` are no-ops. Injection state auto-resets on `framenavigated`. Driver.js instances are stored/cleaned up on `window.__tutorialDriver`. Supports two TTS backends selected via `TTS` env var: `web-speech-api` (default, browser-side Web Speech API) and `edge-tts` (Node-side synthesis via `@andresaya/edge-tts` with browser-side `Audio` playback). Gracefully degrades when speech fails.

- **`lib/fixtures.ts`** — Extends Playwright's `test` with a `tutorial` boolean fixture option driven by `process.env.TUTORIAL`, and a `tutorialObj` fixture that provides a pre-constructed `Tutorial` instance. When using edge-tts, `tutorialObj` teardown automatically merges accumulated audio chunks into the recorded video via ffmpeg. Re-exports `expect`. Tests must import from here, not `@playwright/test`.

- **`lib/audio-merger.ts`** — Utility that merges `AudioChunk[]` into a WebM video using ffmpeg. Positions each MP3 chunk at its correct time offset via `adelay` filters, mixes with `amix`, copies the video stream, and encodes audio as libopus. Requires `ffmpeg` on `PATH`.

- **`playwright.config.ts`** — Typed with `TestOptions` from `lib/fixtures`. Sets `slowMo: 500`, video recording, and a 5-minute test timeout when `TUTORIAL` env var is set. Adds `--enable-speech-dispatcher` Chromium launch arg only when using Web Speech API backend (not edge-tts). Viewport `1600×900` per project.

- **`tests/*.spec.ts`** — Test files that interleave `tutorial.highlight()` calls between standard Playwright actions.

**Data flow:** Test navigates → `tutorialObj` fixture provides `Tutorial(page, active)` → `highlight()` either no-ops (inactive) or injects Driver.js, creates overlay, optionally speaks concurrently (via Web Speech API or edge-tts depending on `TTS` env var), waits for both timeout and speech to finish, destroys overlay → test continues. `speak()` provides standalone narration without a visual overlay. With edge-tts, each synthesized audio buffer is saved with its time offset; on teardown, the fixture merges all chunks into the recorded video via ffmpeg, producing `video-narrated.webm` attached to the test report.

## Conventions

- Import `test`/`expect` from `../lib/fixtures` (not `@playwright/test`) so the `tutorial` fixture option is available.
- Use the `tutorialObj` fixture instead of constructing `Tutorial` manually. It handles creation, start-time tracking, and teardown (audio-video merge).
- For always-on tutorials, use `test.use({ tutorial: true })` at the top of the file.
- `highlight(target, options?)` accepts CSS selector strings or Playwright `Locator`s. Popover fields (`title`, `text`, `side`, `align`, `timeout`) are all optional. An optional `speech` field speaks text via Web Speech API concurrently with the highlight display.
- `speak(text, options?)` provides standalone narration without a visual highlight. Also a no-op when inactive.
- `SpeakOptions` has `rate`, `pitch`, `lang`, and `voice` fields — all optional. The `voice` field is only used with the edge-tts backend.
- TTS backend is selected via `TTS` env var: `web-speech-api` (default) or `edge-tts`. Edge-tts uses Microsoft neural voices via `@andresaya/edge-tts` (requires internet).
- Speech gracefully degrades: Web Speech API silently skips if no voices available; edge-tts silently skips on any failure.
- Chromium requires `--enable-speech-dispatcher` launch arg for Web Speech API (auto-configured in `playwright.config.ts`, skipped when using edge-tts).
- Driver.js is CDN-loaded (not an npm dependency). Version pinned in constants at top of `lib/tutorial.ts`.
- `ffmpeg` must be installed and on `PATH` for narrated video output with edge-tts. If missing, the test still passes but no narrated video is produced.
- All browser-side code runs via `page.evaluate()` — keep it self-contained with no closures over Node variables.
- Preserve the lazy injection pattern (`_ensureDriverJs` with `_injected` flag) and the `framenavigated` listener when modifying the Tutorial class.
