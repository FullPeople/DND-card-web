import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'domestic188.spec.ts',outputDir:'test-results-domestic',workers:1,timeout:45000,reporter:'list',use:{channel:'msedge',baseURL:process.env.DOMESTIC_URL||'http://127.0.0.1:5197',viewport:{width:1920,height:1080}}});
