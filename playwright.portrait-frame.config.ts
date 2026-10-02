import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'portraitFrame.spec.ts',timeout:60000,expect:{timeout:12000},workers:1,
 reporter:'list',outputDir:'test-results/portrait-frame',
 use:{launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined,viewport:{width:1512,height:982},screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'integrated',use:{baseURL:'http://127.0.0.1:5681'}},
  {name:'standalone',use:{baseURL:'http://127.0.0.1:5682'}},
 ],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5681',url:'http://127.0.0.1:5681',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5682',url:'http://127.0.0.1:5682',reuseExistingServer:false},
 ],
});
