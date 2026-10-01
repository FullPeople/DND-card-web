import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'dashboardInteraction221.spec.ts',timeout:45000,expect:{timeout:7000},fullyParallel:false,workers:1,
 outputDir:`../dashboard-interaction221-${process.env.DASHBOARD221_RUN||'r1'}/results`,
 reporter:[['list'],['json',{outputFile:`../dashboard-interaction221-${process.env.DASHBOARD221_RUN||'r1'}/report.json`}]],
 use:{baseURL:'http://127.0.0.1:5280',channel:'msedge',viewport:{width:1280,height:960},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
