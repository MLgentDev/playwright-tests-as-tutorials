import type { Page, Locator, ElementHandle } from '@playwright/test';

const DRIVER_JS_VERSION = '1.4.0';
const DRIVER_CSS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.css`;
const DRIVER_JS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.js.iife.js`;

const DEFAULT_HIGHLIGHT_TIMEOUT = 3000;

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
}

export class Tutorial {
  private _page: Page;
  private _injected = false;

  constructor(page: Page) {
    this._page = page;

    // Reset injection flag on navigation so Driver.js is re-injected on new pages
    this._page.on('framenavigated', (frame) => {
      if (frame === this._page.mainFrame()) {
        this._injected = false;
      }
    });
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

  /**
   * Highlight an element on the page using Driver.js overlay.
   *
   * @param target  - CSS selector or Playwright Locator of the element to highlight
   * @param options - Optional popover content and display settings
   */
  async highlight(target: string | Locator, options?: HighlightOptions): Promise<void> {
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

    await this._page.waitForTimeout(options.timeout ?? DEFAULT_HIGHLIGHT_TIMEOUT);

    await this._page.evaluate(() => {
      const driverObj = (window as any).__tutorialDriver;
      if (driverObj) {
        driverObj.destroy();
        delete (window as any).__tutorialDriver;
      }
    });
  }
}
