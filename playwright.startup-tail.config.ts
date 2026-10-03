import {defineConfig} from '@playwright/test';
const baseline=process.env.STARTUP_BASELINE_CHECK==='1',root=baseline?process.env.STARTUP_BASELINE_DIR!:process.cwd(),out='.local-evidence/startup-tail241/browser'+(baseline?'-baseline':'');
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'startupTail241.spec.ts',workers:1,timeout:45000,expect:{timeout:15000},
 outputDir:out,reporter:[['list'],['json',{outputFile:out+'/report.json'}]],
 use:{viewport:{width:1280,height:850},serviceWorkers:'block',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'standalone',use:{baseURL:'http://127.0.0.1:5820'}},{name:'integrated-entry',use:{baseURL:'http://127.0.0.1:5821'}}],
 webServer:[{command:`node tools/startupPreview.mjs ${root}/dist-standalone 5820`,url:'http://127.0.0.1:5820',reuseExistingServer:false},{command:`node tools/startupPreview.mjs ${root}/dist 5821`,url:'http://127.0.0.1:5821',reuseExistingServer:false}],
});
