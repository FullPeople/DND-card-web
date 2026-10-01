import {defineConfig} from '@playwright/test';
const outputDir=process.env.DND_FOLLOWUP_RESULTS||'.local-evidence/followup231-browser';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['runtimeRecovery231.spec.ts','startup224.spec.ts','startup228.spec.ts','wikiRecovery229.spec.ts'],
 outputDir,timeout:60000,expect:{timeout:15000},workers:1,
 reporter:[['list'],['json',{outputFile:outputDir+'/report.json'}]],
 use:{baseURL:'http://127.0.0.1:5651',viewport:{width:1512,height:982},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}}],
 webServer:{command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5651 --strictPort',cwd:process.env.DND_FOLLOWUP_BUILD||process.cwd(),url:'http://127.0.0.1:5651',reuseExistingServer:false},
});
