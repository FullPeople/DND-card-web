import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'interactionPerformance.spec.ts',workers:1,timeout:1200000,
 outputDir:'test-results-performance-timing',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5320',channel:process.env.CI?undefined:'msedge',viewport:{width:1440,height:960},ignoreHTTPSErrors:!!process.env.PERF_SOURCE_ORIGIN,screenshot:'only-on-failure',trace:'off'},
 webServer:{command:'node tools/cloudPreview.mjs',url:'http://127.0.0.1:5320',reuseExistingServer:false},
});
