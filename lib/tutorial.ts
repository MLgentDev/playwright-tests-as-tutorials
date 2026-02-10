import type { Page } from '@playwright/test';

const DRIVER_JS_VERSION = '1.4.0';
const DRIVER_CSS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.css`;
const DRIVER_JS_URL = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_JS_VERSION}/dist/driver.js.iife.js`;

const DEFAULT_HIGHLIGHT_TIMEOUT = 3000;

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
   * @param selector - CSS selector of the element to highlight
   * @param timeout  - How long (ms) to keep the highlight visible. Default: 3000
   */
  async highlight(selector: string, timeout: number = DEFAULT_HIGHLIGHT_TIMEOUT): Promise<void> {
    await this._ensureDriverJs();

    // Wait for the element to be visible before highlighting
    await this._page.waitForSelector(selector, { state: 'visible' });

    // Create driver instance and highlight the element (no popover)
    await this._page.evaluate((sel: string) => {
      const driverFn = (window as any).driver.js.driver;
      const driverObj = driverFn({
        animate: true,
        overlayOpacity: 0.5,
        stagePadding: 8,
        stageRadius: 5,
        allowClose: false,
        popoverClass: 'tutorial-no-popover',
      });
      driverObj.highlight({ element: sel });
      // Store on window so we can destroy it later
      (window as any).__tutorialDriver = driverObj;
    }, selector);

    // Hold the highlight for the specified duration
    await this._page.waitForTimeout(timeout);

    // Destroy the highlight
    await this._page.evaluate(() => {
      const driverObj = (window as any).__tutorialDriver;
      if (driverObj) {
        driverObj.destroy();
        delete (window as any).__tutorialDriver;
      }
    });
  }
}
