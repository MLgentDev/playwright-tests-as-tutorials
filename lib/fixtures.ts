import { test as base } from '@playwright/test';

export type TestOptions = {
  /** Whether tutorial highlights are active. Driven by TUTORIAL=1 env var. */
  tutorial: boolean;
};

export const test = base.extend<TestOptions>({
  tutorial: [!!process.env.TUTORIAL, { option: true }],
});

export { expect } from '@playwright/test';
