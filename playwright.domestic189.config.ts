import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'domestic189.spec.ts',outputDir:'test-results-domestic189',workers:1,timeout:45000,reporter:'list',use:{channel:'msedge',baseURL:process.env.DOMESTIC_URL||'http://127.0.0.1:5269',viewport:{width:2560,height:1080}}});
