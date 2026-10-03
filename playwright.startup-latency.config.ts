import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'startupLatency.spec.ts',workers:1,timeout:120000,expect:{timeout:30000},
 outputDir:'.local-evidence/startup-latency/browser',reporter:[['list'],['json',{outputFile:'.local-evidence/startup-latency/browser/report.json'}]],
 use:{viewport:{width:1280,height:850},serviceWorkers:'block',trace:'retain-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined},
 projects:[{name:'standalone',use:{baseURL:'http://127.0.0.1:5816'}},{name:'suite-iframe',use:{baseURL:'http://127.0.0.1:5817'}}],
 webServer:[
  {command:'node tools/startupPreview.mjs dist-standalone 5816',url:'http://127.0.0.1:5816',reuseExistingServer:false,env:{DND_STARTUP_HTTP_CACHE:'1'}},
  {command:'node tools/startupPreview.mjs dist 5817',url:'http://127.0.0.1:5817',reuseExistingServer:false,env:{DND_STARTUP_HTTP_CACHE:'1'}},
 ],
});
