import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['workbench-owner-sync.spec.ts','workbench-handshake216.spec.ts','workbench-selection223.spec.ts','workbench-instant217.spec.ts'],workers:1,timeout:45000,expect:{timeout:12000},
 outputDir:'.local-evidence/owner-sync/browser',reporter:[['list'],['json',{outputFile:'.local-evidence/owner-sync/browser/report.json'}]],
 use:{baseURL:'http://127.0.0.1:5792',viewport:{width:1280,height:900},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5792 --strictPort',url:'http://127.0.0.1:5792',reuseExistingServer:false},
});
