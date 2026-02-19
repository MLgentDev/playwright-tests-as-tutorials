import type { Page, Locator, ElementHandle } from '@playwright/test';
import { EdgeTTS } from '@andresaya/edge-tts';

const DRIVER_JS_VERSION = '1.4.0';
const DRIVER_CSS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.css`;
const DRIVER_JS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.js.iife.js`;

const DEFAULT_HIGHLIGHT_TIMEOUT = 3000;
const DEFAULT_EDGE_TTS_VOICE = 'en-US-EmmaMultilingualNeural';
const EDGE_TTS_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

export interface AudioChunk {
  buffer: Buffer;
  offsetMs: number;
}

export interface HighlightOptions {
  /** Popover heading (supports HTML) */
  title?: string;
  /** Popover body text (supports HTML) */
  text?: string;
  /** How long (ms) to keep the highlight visible. Default: 3000 */
  timeout?: number;
  /** Popover placement side */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Popover alignment within the side */
  align?: 'start' | 'center' | 'end';
  /** Text to speak via Web Speech API during the highlight */
  speech?: string;
}

export interface SpeakOptions {
  /** Speech rate (0.1–10). Default: 1.0 */
  rate?: number;
  /** Speech pitch (0–2). Default: 1.0 */
  pitch?: number;
  /** BCP 47 language tag, e.g. 'en-US' */
  lang?: string;
  /** Edge TTS voice name, e.g. 'en-US-AriaNeural'. Only used with edge-tts backend. */
  voice?: string;
}

export class Tutorial {
  private _page: Page;
  private _injected = false;
  private _active: boolean;
  private _ttsBackend: 'web-speech-api' | 'edge-tts';
  private _audioChunks: AudioChunk[] = [];
  private _startTime = 0;

  /**
   * @param page   - Playwright Page instance
   * @param active - When `false` (default), all highlight() calls are silent no-ops.
   *                 Pass `true` to enable Driver.js overlays.
   */
  constructor(page: Page, active: boolean = false) {
    this._page = page;
    this._active = active;
    this._ttsBackend = process.env.TTS === 'edge-tts' ? 'edge-tts' : 'web-speech-api';

    // Reset injection flag on navigation so Driver.js is re-injected on new pages
    this._page.on('framenavigated', (frame) => {
      if (frame === this._page.mainFrame()) {
        this._injected = false;
      }
    });
  }

  /** Set the start time for audio chunk offset tracking */
  setStartTime(t: number): void {
    this._startTime = t;
  }

  /** Get accumulated audio chunks for post-processing */
  getAudioChunks(): AudioChunk[] {
    return this._audioChunks;
  }

  /** Lazily inject Driver.js CSS and JS into the current page */
  private async _ensureDriverJs(): Promise<void> {
    if (this._injected) return;

    await this._page.addStyleTag({ url: DRIVER_CSS_URL });
    await this._page.addScriptTag({ url: DRIVER_JS_URL });

    // Wait until the driver global is available
    await this._page.waitForFunction(() => !!(window as any).driver?.js?.driver);

    this._injected = true;
  }

  /** Dispatch speech to the configured TTS backend */
  private async _speak(text: string, options?: SpeakOptions): Promise<void> {
    if (this._ttsBackend === 'edge-tts') {
      return this._speakEdgeTts(text, options);
    }
    return this._speakWebSpeechApi(text, options);
  }

  /** Speak text using the browser's Web Speech API */
  private async _speakWebSpeechApi(text: string, options?: SpeakOptions): Promise<void> {
    await this._page.evaluate(({ t, opts }) => {
      return new Promise<void>(async (resolve) => {
        // Wait for voices to load — they may not be available synchronously
        if (window.speechSynthesis.getVoices().length === 0) {
          await new Promise<void>((voicesReady) => {
            window.speechSynthesis.onvoiceschanged = () => voicesReady();
            setTimeout(voicesReady, 3000);
          });
        }

        // If no voices available after waiting, skip speech entirely
        if (window.speechSynthesis.getVoices().length === 0) {
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(t);
        utterance.rate = opts?.rate ?? 1.0;
        utterance.pitch = opts?.pitch ?? 1.0;
        if (opts?.lang) utterance.lang = opts.lang;
        // Safety timeout: resolve after 30s even if speech events don't fire
        const timer = setTimeout(() => resolve(), 30_000);
        utterance.onend = () => { clearTimeout(timer); resolve(); };
        utterance.onerror = () => { clearTimeout(timer); resolve(); };
        window.speechSynthesis.speak(utterance);
      });
    }, { t: text, opts: options });
  }

  /** Speak text using Microsoft neural voices via edge-tts (Node-side synthesis, browser-side playback) */
  private async _speakEdgeTts(text: string, options?: SpeakOptions): Promise<void> {
    try {
      const voice = options?.voice ?? DEFAULT_EDGE_TTS_VOICE;
      // Capture offset BEFORE synthesis to avoid counting synthesis latency
      const offsetMs = this._startTime > 0 ? Date.now() - this._startTime : -1;
      const tts = new EdgeTTS();
      await tts.synthesize(text, voice, {
        rate: options?.rate !== undefined ? `${options.rate >= 1 ? '+' : ''}${Math.round((options.rate - 1) * 100)}%` : undefined,
        pitch: options?.pitch !== undefined ? `${options.pitch >= 1 ? '+' : ''}${Math.round((options.pitch - 1) * 50)}Hz` : undefined,
        outputFormat: EDGE_TTS_FORMAT,
      });
      const base64 = await tts.toBase64();

      // Track audio chunk for post-processing into recorded video
      if (offsetMs >= 0) {
        this._audioChunks.push({
          buffer: Buffer.from(base64, 'base64'),
          offsetMs,
        });
      }

      await this._page.evaluate((audioData) => {
        return new Promise<void>((resolve) => {
          const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
          const timer = setTimeout(() => resolve(), 30_000);
          audio.onended = () => { clearTimeout(timer); resolve(); };
          audio.onerror = () => { clearTimeout(timer); resolve(); };
          audio.play().catch(() => { clearTimeout(timer); resolve(); });
        });
      }, base64);
    } catch {
      // Graceful degradation: silently skip speech on failure
    }
  }

  /**
   * Speak text aloud without any visual highlight.
   * No-op when tutorial is inactive.
   */
  async speak(text: string, options?: SpeakOptions): Promise<void> {
    if (!this._active) return;
    await this._speak(text, options);
  }

  /**
   * Highlight an element on the page using Driver.js overlay.
   *
   * @param target  - CSS selector or Playwright Locator of the element to highlight
   * @param options - Optional popover content and display settings
   */
  async highlight(target: string | Locator, options?: HighlightOptions): Promise<void> {
    if (!this._active) return;

    let handle: ElementHandle | null;
    if (typeof target === 'string') {
      handle = await this._page.waitForSelector(target, { state: 'visible' });
    } else {
      await target.waitFor({ state: 'visible' });
      handle = await target.elementHandle();
    }
    if (!handle) throw new Error('Could not resolve element to highlight');
    await this._highlightElement(handle, options ?? {});
  }

  /** Shared implementation: inject Driver.js, highlight the element, wait, then destroy. */
  private async _highlightElement(handle: ElementHandle, options: HighlightOptions): Promise<void> {
    await this._ensureDriverJs();

    const hasPopover = !!(options.title || options.text);
    const popoverData = hasPopover
      ? { title: options.title, text: options.text, side: options.side, align: options.align }
      : null;

    await handle.evaluate((el, opts) => {
      const driverFn = (window as any).driver.js.driver;
      const driverConfig: Record<string, any> = {
        animate: true,
        overlayOpacity: 0.5,
        stagePadding: 8,
        stageRadius: 5,
        allowClose: false,
      };
      if (!opts) {
        driverConfig.popoverClass = 'tutorial-no-popover';
      }
      const driverObj = driverFn(driverConfig);

      const step: Record<string, any> = { element: el as Element };
      if (opts) {
        step.popover = {
          title: opts.title,
          description: opts.text,
          side: opts.side,
          align: opts.align,
        };
      }
      driverObj.highlight(step);
      (window as any).__tutorialDriver = driverObj;
    }, popoverData);

    // Wait for both the timeout and any speech to finish before destroying
    const waitPromises: Promise<void>[] = [
      this._page.waitForTimeout(options.timeout ?? DEFAULT_HIGHLIGHT_TIMEOUT),
    ];
    if (options.speech) {
      waitPromises.push(this._speak(options.speech));
    }
    await Promise.all(waitPromises);

    await this._page.evaluate(() => {
      const driverObj = (window as any).__tutorialDriver;
      if (driverObj) {
        driverObj.destroy();
        delete (window as any).__tutorialDriver;
      }
    });
  }
}
