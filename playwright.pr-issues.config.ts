import {defineConfig} from '@playwright/test';
const publicURL=process.env.DND_ISSUE_PUBLIC_URL;
export default defineConfig({testDir:'./tests/e2e',testMatch:'prIssues287.spec.ts',outputDir:publicURL?'test-results-pr-issues-public':'test-results-pr-issues',timeout:45000,workers:1,reporter:'list',use:{baseURL:publicURL||'http://127.0.0.1:5320',channel:process.env.CI?undefined:'msedge',viewport:{width:1440,height:960}},webServer:publicURL?undefined:{command:'node tools/cloudPreview.mjs',url:'http://127.0.0.1:5320',reuseExistingServer:false}});
