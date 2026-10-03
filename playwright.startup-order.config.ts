import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'startupNoticeOrder.spec.ts',workers:1,timeout:45000,expect:{timeout:12000},
 outputDir:'.local-evidence/startup-order',reporter:[['list'],['json',{outputFile:'.local-evidence/startup-order/report.json'}]],
 use:{viewport:{width:1280,height:850},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined},
 projects:[{name:'standalone',use:{baseURL:'http://127.0.0.1:5726'}},{name:'suite',use:{baseURL:'http://127.0.0.1:5727'}}],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5726 --strictPort',url:'http://127.0.0.1:5726',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5727 --strictPort',url:'http://127.0.0.1:5727',reuseExistingServer:false},
 ],
});
