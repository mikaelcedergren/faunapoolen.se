import { defineConfig, devices } from '@playwright/test';

// Smoke test against the static site, served on a DEDICATED port so it never collides with the
// always-on server (:3040). Chromium only — shares the cortex/bitsize/blinkdrop browser cache.
const PORT = 4341;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `PORT=${PORT} node server/index.mjs`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
