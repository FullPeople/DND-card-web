import {defineConfig} from '@playwright/test';
const remote=process.env.AC_TEST_URL;
export default defineConfig({testDir:'./tests/e2e',testMatch:'ac193.spec.ts',outputDir:'test-results-ac193',workers:1,timeout:30000,reporter:'list',use:{baseURL:remote||'http://127.0.0.1:5416/',viewport:{width:1920,height:1080},channel:process.env.CI?undefined:'msedge'},webServer:remote?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5416 --strictPort',url:'http://127.0.0.1:5416',reuseExistingServer:false}});
