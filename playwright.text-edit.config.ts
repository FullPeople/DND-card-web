import {defineConfig} from '@playwright/test';
const output=process.env.DND_TEXT_EDIT_RESULTS||'.local-evidence/text-edit';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['displayTextEdits.spec.ts','runtimeRecovery231.spec.ts','backupRuntimeRecovery231.spec.ts'],timeout:60000,expect:{timeout:15000},workers:1,retries:0,
 outputDir:output,reporter:[['list'],['json',{outputFile:output+'/report.json'}]],
 use:{baseURL:'http://127.0.0.1:5686',serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1512,height:982}}},{name:'narrow-chromium',use:{browserName:'chromium',viewport:{width:393,height:852}}}],
 webServer:{command:`"${process.execPath}" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5686 --strictPort --outDir dist-standalone`,url:'http://127.0.0.1:5686',reuseExistingServer:false},
});
