import {defineConfig} from '@playwright/test';
const port=process.env.DND_SWITCH_LAB_PORT||'5484';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'switch-lab.spec.ts',workers:1,timeout:60000,
 outputDir:'test-results-switch-lab',reporter:[['list']],
 use:{baseURL:process.env.DND_SWITCH_LAB_URL||`http://127.0.0.1:${port}/card-switch-lab/`,channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:process.env.DND_SWITCH_LAB_URL?undefined:{command:`node node_modules/vite/bin/vite.js preview --config vite.switch-lab.config.ts --port ${port}`,url:`http://127.0.0.1:${port}/card-switch-lab/`,reuseExistingServer:false},
});
