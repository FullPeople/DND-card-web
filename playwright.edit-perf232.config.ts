import {defineConfig} from '@playwright/test';
const outputDir=process.env.DND_PERF_OUTPUT||'.local-evidence/edit-perf232';
const baseline=process.env.DND_PERF_BASELINE_DIR,candidate=process.env.DND_PERF_CANDIDATE_DIR||'dist-standalone';
const external=process.env.DND_PERF_URL;
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'editPerformance232.spec.ts',timeout:120000,workers:1,
 reporter:[['list'],['json',{outputFile:outputDir+'/report.json'}]],outputDir,
 use:{viewport:{width:1512,height:982},serviceWorkers:'block',launchOptions:process.env.DND_BROWSER_EXECUTABLE?{executablePath:process.env.DND_BROWSER_EXECUTABLE}:undefined,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:external?[{name:'external',use:{baseURL:external}}]:[
  ...(baseline?[{name:'baseline',use:{baseURL:'http://127.0.0.1:5674'}}]:[]),
  {name:'candidate',use:{baseURL:'http://127.0.0.1:5675'}},
 ],
 webServer:external?undefined:[
  ...(baseline?[{command:`node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5674 --strictPort --outDir ${JSON.stringify(baseline)}`,url:'http://127.0.0.1:5674',reuseExistingServer:false}]:[]),
  {command:`node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5675 --strictPort --outDir ${JSON.stringify(candidate)}`,url:'http://127.0.0.1:5675',reuseExistingServer:false},
 ],
});
