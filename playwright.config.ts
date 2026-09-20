import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 10000 }, fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0, workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5178', trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1512, height: 982 } },
  projects: [
    { name: 'chromium', testIgnore: '**/offline.spec.ts', use: { channel: process.env.CI ? undefined : 'msedge' } },
    { name: 'production-offline', testMatch: '**/offline.spec.ts', use: { channel: process.env.CI ? undefined : 'msedge', baseURL: 'http://127.0.0.1:4178' } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI },
    { command: 'npm run build && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4178', url: 'http://127.0.0.1:4178', reuseExistingServer: !process.env.CI },
  ],
});
