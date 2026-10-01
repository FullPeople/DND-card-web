import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'resourceDashboard220.spec.ts',timeout:45000,expect:{timeout:10000},fullyParallel:false,workers:1,
 outputDir:`../dashboard-e2e-${process.env.DASHBOARD220_RUN||'r1'}/results`,
 reporter:[['list'],['json',{outputFile:`../dashboard-e2e-${process.env.DASHBOARD220_RUN||'r1'}/report.json`}]],
 use:{baseURL:'http://127.0.0.1:5280',channel:'msedge',viewport:{width:1280,height:960},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
