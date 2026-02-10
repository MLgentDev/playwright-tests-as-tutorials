import type { Page, Locator, ElementHandle } from '@playwright/test';

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
    const handle = await this._page.waitForSelector(selector, { state: 'visible' });
    if (!handle) throw new Error(`Could not find visible element for selector: ${selector}`);
    await this._highlightElement(handle, timeout);
  }

  async highlightLocator(locator: Locator, timeout: number = DEFAULT_HIGHLIGHT_TIMEOUT): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    const handle = await locator.elementHandle();
    if (!handle) throw new Error('Could not resolve locator to an element handle');
    await this._highlightElement(handle, timeout);
  }

  /** Shared implementation: inject Driver.js, highlight the element, wait, then destroy. */
  private async _highlightElement(handle: ElementHandle, timeout: number): Promise<void> {
    await this._ensureDriverJs();

    await handle.evaluate((el) => {
      const driverFn = (window as any).driver.js.driver;
      const driverObj = driverFn({
        animate: true,
        overlayOpacity: 0.5,
        stagePadding: 8,
        stageRadius: 5,
        allowClose: false,
        popoverClass: 'tutorial-no-popover',
      });
      driverObj.highlight({ element: el as Element });
      (window as any).__tutorialDriver = driverObj;
    });

    await this._page.waitForTimeout(timeout);

    await this._page.evaluate(() => {
      const driverObj = (window as any).__tutorialDriver;
      if (driverObj) {
        driverObj.destroy();
        delete (window as any).__tutorialDriver;
      }
    });
  }
}
