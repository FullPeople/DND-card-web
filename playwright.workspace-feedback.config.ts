import {defineConfig} from '@playwright/test';
const suite=process.env.DND_WORKSPACE_SUITE==='1',port=suite?5695:5693,baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:'./tests/e2e',testMatch:suite?['feedback198.spec.ts']:['workspaceFeedback.spec.ts','announcement.spec.ts','automationProgress.spec.ts','wikiColumns232.spec.ts','wikiMotion232.spec.ts'],
 grep:suite?/DND suite-mode announcement/:undefined,
 outputDir:`.local-evidence/workspace-feedback/${suite?'suite-browser':'browser'}`,workers:1,timeout:45000,expect:{timeout:12000},
 reporter:[['list'],['json',{outputFile:`.local-evidence/workspace-feedback/${suite?'suite-browser-report':'browser-report'}.json`}]],
 use:{baseURL,viewport:{width:1512,height:982},serviceWorkers:'block',channel:process.env.CI?undefined:'msedge',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:`node node_modules/vite/bin/vite.js preview ${suite?'':'--mode standalone'} --host 127.0.0.1 --port ${port} --strictPort`,url:baseURL,reuseExistingServer:false},
});
