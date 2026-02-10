import { test, expect } from '@playwright/test';
import { Tutorial } from '../lib/tutorial';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // Highlight the hero heading
  await tutorial.highlight('.hero__title');
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const tutorial = new Tutorial(page);

  // Highlight the "Get started" link before clicking it
  await tutorial.highlight('a.getStarted_Sjon');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

  // Highlight the Installation heading
  await tutorial.highlight('header h1');
});
