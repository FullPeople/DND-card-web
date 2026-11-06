import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'sourceClassSpellFilter.spec.ts',outputDir:'.local-evidence/source-class-spell-filter',timeout:45000,expect:{timeout:10000},workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5597',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1512,height:982}}},{name:'narrow',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'"'+process.execPath+'" node_modules/vite/bin/vite.js --config vite.standalone-cloud.config.ts --mode standalone --host 127.0.0.1 --port 5597 --strictPort',url:'http://127.0.0.1:5597/card/',reuseExistingServer:false},
});
