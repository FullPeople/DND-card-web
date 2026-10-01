import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'resourceDashboard220Compatibility.spec.ts',timeout:45000,expect:{timeout:10000},workers:1,
 outputDir:`../dashboard-compatibility-${process.env.DASHBOARD220_RUN||'r1'}/results`,
 reporter:[['list'],['json',{outputFile:`../dashboard-compatibility-${process.env.DASHBOARD220_RUN||'r1'}/report.json`}]],
 use:{baseURL:process.env.DND_RESOURCE_BASE_URL||'http://127.0.0.1:5280',channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
