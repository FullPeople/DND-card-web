import {defineConfig} from '@playwright/test';
const port=process.env.DND_RELEASE_TEST_PORT||'5193';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['workbench-handshake216.spec.ts','feedback205.spec.ts','ac193.spec.ts','import192.spec.ts','refinement186.spec.ts','activity185.spec.ts','sources185.spec.ts','refinement183.spec.ts','spells-179.spec.ts','live-update-179.spec.ts','resource-burst182.spec.ts','control-settlement182.spec.ts','inventory-race181.spec.ts','inventory-queue-181.spec.ts','save-race-179.spec.ts'],
 timeout:45000,expect:{timeout:10000},fullyParallel:true,forbidOnly:!!process.env.CI,workers:2,
 reporter:[['list'],['html',{open:'never'}]],use:{baseURL:`http://127.0.0.1:${port}`,channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false}
});
