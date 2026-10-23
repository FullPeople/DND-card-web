import {defineConfig} from '@playwright/test';

// This suite covers the formal standalone cloud profile. Embedded/default
// builds deliberately do not retain multiple editable card surfaces.
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'retainedCardSwitch.spec.ts',outputDir:'.local-evidence/retained-card-browser',timeout:45000,workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5550',channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'"'+process.execPath+'" node_modules/vite/bin/vite.js --config vite.standalone-cloud.config.ts --mode standalone --host 127.0.0.1 --port 5550 --strictPort',url:'http://127.0.0.1:5550/card/',reuseExistingServer:false},
});
