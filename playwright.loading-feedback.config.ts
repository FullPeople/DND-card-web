import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['overviewDashboard235.spec.ts'],
 timeout:45000,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5330',channel:process.env.CI?undefined:'msedge',serviceWorkers:'block'},
 webServer:{command:'node node_modules/vite/bin/vite.js --config vite.loading-feedback.config.ts',url:'http://127.0.0.1:5330',reuseExistingServer:!process.env.CI}
});
