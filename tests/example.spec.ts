import { test, expect } from '@playwright/test';
import { Tutorial } from '../lib/tutorial';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // Highlight the hero heading
  await tutorial.highlight('.hero__title', {
    title: 'Playwright',
    text: 'This is the main hero heading of the Playwright website.',
  });
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Highlight the "Get started" link before clicking it
  await tutorial.highlight('a.getStarted_Sjon', {
    title: 'Get Started',
    text: 'Click this link to navigate to the installation guide.',
  });

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

  // Highlight the Installation heading
  await tutorial.highlight('header h1', {
    title: 'Installation',
    text: 'You are now on the Installation page.',
    side: 'bottom',
  });
});

test('get started link with playwright selectors', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Highlight the hero heading using a Playwright locator
  await tutorial.highlight(page.getByRole('heading', { name: /Playwright/ }), {
    title: 'Hero Heading',
    text: 'Located using a Playwright role locator.',
    side: 'bottom',
    align: 'center',
  });

  // Highlight the "Get started" link using a Playwright locator
  const getStartedLink = page.getByRole('link', { name: 'Get started' });
  await tutorial.highlight(getStartedLink, {
    text: 'This link takes you to the docs. Located via getByRole.',
  });

  // Click the get started link
  await getStartedLink.click();

  // Expects page to have a heading with the name of Installation
  const installHeading = page.getByRole('heading', { name: 'Installation' });
  await expect(installHeading).toBeVisible();

  // Highlight the Installation heading using a Playwright locator
  await tutorial.highlight(installHeading, {
    title: 'Installation',
    side: 'bottom',
    align: 'start',
  });
});

test('highlight without popover', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Overlay-only highlight (no popover) — same as original behavior
  await tutorial.highlight('.hero__title');

  // Overlay-only with custom timeout
  await tutorial.highlight('.hero__title', { timeout: 2000 });
});
