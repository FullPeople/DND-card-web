import {defineConfig} from '@playwright/test';

const output=process.env.SURFACE_MOTION_OUT||'test-results/surface-motion-app';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'surfaceMotionApp.spec.ts',workers:1,retries:0,forbidOnly:!!process.env.CI,
 timeout:90000,expect:{timeout:10000},outputDir:output,
 reporter:[['list'],['json',{outputFile:output+'/results.json'}]],
 use:{baseURL:'http://127.0.0.1:5490',channel:process.env.CI?undefined:'msedge',headless:true,viewport:{width:1512,height:982},
   serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 // Serve an existing formal cloud build; no source transform, replacement App or release-guard bypass.
 webServer:{command:'node tests/fixtures/surface-motion-app/server.mjs',url:'http://127.0.0.1:5490/__motion/status',reuseExistingServer:false,timeout:30000},
});
