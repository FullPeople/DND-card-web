import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  outputDir:process.env.DND_INTEGRATION_RESULTS||'.local-evidence/integration230-browser',
  timeout:60000,
  expect:{timeout:15000},
  workers:1,
  reporter:[['list'],['json',{outputFile:(process.env.DND_INTEGRATION_RESULTS||'.local-evidence/integration230-browser')+'/report.json'}]],
  use:{channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'selection',testMatch:['workbench-selection223.spec.ts','workbench-instant217.spec.ts','workbench-handshake216.spec.ts','groupRoll217.spec.ts'],use:{baseURL:'http://127.0.0.1:5640',serviceWorkers:'block'}},
    {name:'standalone',testMatch:['startup228.spec.ts','startup224.spec.ts','automationChoices.spec.ts','localFeedback212.spec.ts','wikiRecovery229.spec.ts','announcement.spec.ts'],use:{baseURL:'http://127.0.0.1:5641',serviceWorkers:'block'}},
  ],
  webServer:[
    {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5640 --strictPort',url:'http://127.0.0.1:5640',reuseExistingServer:false},
    {command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5641 --strictPort',url:'http://127.0.0.1:5641',reuseExistingServer:false},
  ],
});
