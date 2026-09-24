import {defineConfig} from '@playwright/test';
const remote=process.env.IMPORT_TEST_URL;
export default defineConfig({testDir:'./tests/e2e',testMatch:'import192.spec.ts',outputDir:'test-results-import192',workers:1,timeout:30000,reporter:'list',use:{baseURL:remote||'http://127.0.0.1:5415/',channel:process.env.CI?undefined:'msedge'},webServer:remote?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5415 --strictPort',url:'http://127.0.0.1:5415',reuseExistingServer:false}});
