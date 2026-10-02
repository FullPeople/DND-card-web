import {defineConfig} from '@playwright/test';
const outputDir=process.env.DND_FOLLOWUP_UI_RESULTS||'.local-evidence/followup231-ui';
export default defineConfig({
 testDir:'./tests/e2e',outputDir,timeout:60000,expect:{timeout:15000},workers:1,forbidOnly:!!process.env.CI,
 reporter:[['list'],['json',{outputFile:outputDir+'/report.json'}]],
 use:{viewport:{width:1512,height:982},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:['chromium','firefox'].flatMap(browserName=>[
  {name:browserName+'-resources',testMatch:['resourceFollowup231.spec.ts','resourceRedesign232.spec.ts'],use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5660'}},
  {name:browserName+'-dice-wide',testMatch:['diceFrame230.spec.ts'],use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5660'}},
  {name:browserName+'-dice-narrow',testMatch:['diceFrame230.spec.ts'],use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5660',viewport:{width:390,height:844}}},
  {name:browserName+'-choices',testMatch:['automationChoiceFollowup230.spec.ts'],use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5662'}},
  {name:browserName+'-lifecycle',testMatch:['automationChoices.spec.ts'],grep:/(resources keep presentation|title menu reclaims equipment)/,use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5662'}},
  {name:browserName+'-migration',testMatch:['migrationFeedback214.spec.ts'],grep:/all-custom old card/,use:{browserName:browserName as 'chromium'|'firefox',baseURL:'http://127.0.0.1:5663'}},
 ]),
 webServer:[
  {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5660 --strictPort',url:'http://127.0.0.1:5660',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js --mode automation-standalone --host 127.0.0.1 --port 5662 --strictPort',url:'http://127.0.0.1:5662',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js --mode standalone --host 127.0.0.1 --port 5663 --strictPort',url:'http://127.0.0.1:5663',reuseExistingServer:false},
 ],
});
