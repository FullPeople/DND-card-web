import {defineConfig} from '@playwright/test';
const outputDir='.local-evidence/dashboard237';
export default defineConfig({
 testDir:'./tests/e2e',
 timeout:60000,expect:{timeout:10000},workers:1,fullyParallel:false,
 outputDir:outputDir+'/results',reporter:[['list'],['json',{outputFile:outputDir+'/report.json'}]],
 use:{baseURL:'http://127.0.0.1:5647',viewport:{width:1280,height:960},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium-fixtures',testMatch:['dashboardAppearance237.spec.ts','overviewDashboard235.spec.ts','dashboardInteraction221.spec.ts'],use:{browserName:'chromium'}},{name:'chromium-app',testMatch:'resourceDashboard220App.spec.ts',use:{browserName:'chromium',baseURL:'http://127.0.0.1:5648'}}],
 webServer:[{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5647 --strictPort',url:'http://127.0.0.1:5647',reuseExistingServer:false},{command:'node node_modules/vite/bin/vite.js --mode standalone --host 127.0.0.1 --port 5648 --strictPort',url:'http://127.0.0.1:5648',reuseExistingServer:false}],
});
