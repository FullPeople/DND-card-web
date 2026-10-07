import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'classLevelChoices.spec.ts',timeout:60000,workers:1,
 reporter:[['list'],['json',{outputFile:'.local-evidence/class-level-choices/browser-report.json'}]],
 outputDir:'.local-evidence/class-level-choices/browser',
 use:{baseURL:'http://127.0.0.1:5197',serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{viewport:{width:1512,height:982}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
 ...(process.env.CLASS_CHOICE_EDGE_EXECUTABLE?[{name:'edge',use:{viewport:{width:1512,height:982},launchOptions:{executablePath:process.env.CLASS_CHOICE_EDGE_EXECUTABLE}}}]:[])],
 webServer:{command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5197',url:'http://127.0.0.1:5197',reuseExistingServer:false},
});
