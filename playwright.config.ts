import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against exported web builds:
 *  - project "local":   apps/mobile/dist          (no backend – local mode)
 *  - project "backend": apps/mobile/dist-backend  (built with EXPO_PUBLIC_SUPABASE_* → local Supabase stack)
 * Build: `npm run build:web` and `npm run build:web:backend` (see package.json).
 */
const common = {
  ...devices['iPhone 13'],
  browserName: 'chromium' as const,
  launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
  trace: 'retain-on-failure' as const,
  screenshot: 'only-on-failure' as const,
};

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    { name: 'local', testIgnore: /backend/, use: { ...common, baseURL: 'http://localhost:8099' } },
    { name: 'backend', testMatch: /backend/, use: { ...common, baseURL: 'http://localhost:8098' } },
  ],
  webServer: [
    { command: 'node scripts/serve-web.mjs apps/mobile/dist 8099', url: 'http://localhost:8099', reuseExistingServer: true },
    { command: 'node scripts/serve-web.mjs apps/mobile/dist-backend 8098', url: 'http://localhost:8098', reuseExistingServer: true },
  ],
});
