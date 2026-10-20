import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'invocationActivation.spec.ts',timeout:120000,workers:1,reporter:'list',outputDir:'test-results-feedback-invocation',
 use:{baseURL:'http://127.0.0.1:5372',channel:process.env.CI?undefined:'msedge',serviceWorkers:'block',actionTimeout:15000,navigationTimeout:30000,screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1512,height:982}}},{name:'narrow',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'node node_modules/vite/bin/vite.js --config vite.loading-feedback.config.ts --mode standalone --port 5372',url:'http://127.0.0.1:5372',reuseExistingServer:false},
});
