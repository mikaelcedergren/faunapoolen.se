import { test as baseTest } from '@playwright/test';
import { createHermeticPlaywrightTest } from '@mikaelcedergren/cx-framework/platform/e2e-runner';
export const test = createHermeticPlaywrightTest(baseTest);
export { expect } from '@playwright/test';
export type * from '@playwright/test';
