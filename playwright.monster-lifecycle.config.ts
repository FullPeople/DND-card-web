import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['monster-lifecycle234.spec.ts'],timeout:60000,expect:{timeout:15000},workers:1,
 reporter:[['list'],['json',{outputFile:'test-results/monster-lifecycle/report.json'}]],outputDir:'test-results/monster-lifecycle',
 use:{baseURL:'http://127.0.0.1:5644',channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure',serviceWorkers:'block'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5644 --strictPort',url:'http://127.0.0.1:5644',reuseExistingServer:false},
});
