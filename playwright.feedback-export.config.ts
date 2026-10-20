import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',testMatch:'feedback-export-currency.spec.ts',
 timeout:120000,workers:1,reporter:'list',
 outputDir:'test-results-feedback-export',
 use:{baseURL:'http://127.0.0.1:5367',channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},serviceWorkers:'block',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --config vite.loading-feedback.config.ts --mode standalone --port 5367',url:'http://127.0.0.1:5367',reuseExistingServer:false},
});
