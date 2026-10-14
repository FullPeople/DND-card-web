import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'bcPerformance296.spec.ts',workers:1,timeout:60000,expect:{timeout:15000},
 outputDir:'.local-evidence/bc-performance296',reporter:'list',
 use:{viewport:{width:1280,height:850},serviceWorkers:'block',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'standalone',use:{baseURL:'http://127.0.0.1:5820'}},{name:'integrated-entry',use:{baseURL:'http://127.0.0.1:5821'}}],
 webServer:[{command:'node tools/startupPreview.mjs dist-standalone 5820',url:'http://127.0.0.1:5820',reuseExistingServer:false},{command:'node tools/startupPreview.mjs dist 5821',url:'http://127.0.0.1:5821',reuseExistingServer:false}],
});
