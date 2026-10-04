import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'saveBonuses.spec.ts',outputDir:'.local-evidence/save-bonuses-browser',
 timeout:45000,expect:{timeout:10000},workers:1,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,reporter:'list',
 use:{viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'integrated',use:{baseURL:'http://127.0.0.1:5696'}},
  {name:'standalone',use:{baseURL:'http://127.0.0.1:5697'}},
 ],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5696 --strictPort',url:'http://127.0.0.1:5696',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5697 --strictPort',url:'http://127.0.0.1:5697',reuseExistingServer:false},
 ],
});
