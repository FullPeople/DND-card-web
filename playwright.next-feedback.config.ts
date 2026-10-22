import {defineConfig} from '@playwright/test';

const output='test-results/next-feedback';
const serverCommand='node --input-type=module -e "'+
 "import {createServer} from 'vite';"+
 "const server=await createServer({configFile:'vite.config.ts',mode:'automation-standalone',cacheDir:'.cache/next-feedback-vite',server:{host:'127.0.0.1',port:5486,strictPort:true}});"+
 'await server.listen();"';

export default defineConfig({
 testDir:'./tests/e2e',testMatch:['scopedPalette.spec.ts','numberInputSwitch.spec.ts'],
 fullyParallel:false,workers:1,retries:0,forbidOnly:!!process.env.CI,timeout:60000,expect:{timeout:10000},
 outputDir:output,reporter:[['list'],['json',{outputFile:`${output}/results.json`}]],
 use:{baseURL:'http://127.0.0.1:5486',channel:process.env.CI?undefined:'msedge',headless:true,viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 // Load the normal config and every source/release guard; isolate only its port and dependency cache.
 webServer:{command:serverCommand,url:'http://127.0.0.1:5486/card/?intro=0',reuseExistingServer:false,timeout:120000},
});
