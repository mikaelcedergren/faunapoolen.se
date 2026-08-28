import { defineConfig } from '@playwright/test';
import {
  createHermeticPlaywrightUse,
  validateOwnedE2ERuntime,
} from '@mikaelcedergren/cx-framework/platform/e2e-runner';
import path from 'node:path';

// Smoke test uses the runner-selected app origin and runner-owned exact-origin proxy.
const RUNTIME = validateOwnedE2ERuntime({ productId: 'faunapoolen' });

export default defineConfig({
  testDir: './e2e',
  outputDir: path.join(RUNTIME.root, 'playwright-output'),
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: process.env.CI === '1',
  reporter: 'list',
  use: createHermeticPlaywrightUse(RUNTIME),
  projects: [{ name: 'chromium' }],
});
