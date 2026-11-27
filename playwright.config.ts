import { defineConfig } from '@playwright/test';

/**
 * Browser tests run against a production build (`next build && next start`)
 * connected to the local Supabase-compatible test stack. See docs/TEST_REPORT.md.
 *   CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] }
      : undefined,
  },
  projects: [
    { name: 'public', testMatch: /public\.spec\.ts/ },
    { name: 'admin', testMatch: /admin\.spec\.ts/, dependencies: ['public'] },
    { name: 'responsive', testMatch: /responsive\.spec\.ts/, dependencies: ['admin'] },
  ],
});
