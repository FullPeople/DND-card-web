import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['workbench-selection223.spec.ts','workbench-instant217.spec.ts','workbench-handshake216.spec.ts','groupRoll217.spec.ts'],
 outputDir:process.env.SELECTION_RESULTS||'../selection223/web-browser',timeout:60000,expect:{timeout:10000},workers:1,
 reporter:[['list'],['json',{outputFile:process.env.SELECTION_JSON||'../selection223/web-browser/report.json'}]],
 use:{channel:process.env.CI?undefined:'msedge',baseURL:'http://127.0.0.1:5633',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5633 --strictPort',url:'http://127.0.0.1:5633',reuseExistingServer:false}
});
