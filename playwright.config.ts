import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 10000 }, fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0, workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5178', trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1512, height: 982 } },
  projects: [{ name: 'chromium', use: { channel: process.env.CI ? undefined : 'msedge' } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI },
});
