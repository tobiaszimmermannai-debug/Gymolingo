import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the exported web build (apps/mobile/dist).
 * Build first: `npm run build:web` (optionally with EXPO_PUBLIC_SUPABASE_* for backend tests).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8099',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-web.mjs apps/mobile/dist 8099',
    url: 'http://localhost:8099',
    reuseExistingServer: true,
  },
});
