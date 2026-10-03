import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['proficiencyDragRouting.spec.ts','cardPresentation235.spec.ts','overviewDashboard235.spec.ts'],
 outputDir:'.local-evidence/card-fixes235',timeout:60000,expect:{timeout:15000},workers:1,
 reporter:[['list'],['json',{outputFile:'.local-evidence/card-fixes235/report.json'}]],
 use:{baseURL:'http://127.0.0.1:5695',viewport:{width:1512,height:982},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5695 --strictPort',url:'http://127.0.0.1:5695',reuseExistingServer:false},
});
