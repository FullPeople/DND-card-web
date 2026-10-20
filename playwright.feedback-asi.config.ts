import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',testMatch:'featAbilityAllocation.spec.ts',
 timeout:120000,workers:1,reporter:'list',outputDir:'test-results-feedback-asi',
 use:{baseURL:'http://127.0.0.1:5367',channel:process.env.CI?undefined:'msedge',serviceWorkers:'block',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1512,height:982}}},{name:'narrow',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'node node_modules/vite/bin/vite.js --config vite.loading-feedback.config.ts --mode standalone --port 5367',url:'http://127.0.0.1:5367',reuseExistingServer:false},
});
