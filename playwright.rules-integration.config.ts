import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',timeout:45000,expect:{timeout:10000},workers:1,retries:0,forbidOnly:!!process.env.CI,
 outputDir:'.local-evidence/rules-integration-browser',reporter:[['list'],['json',{outputFile:'.local-evidence/rules-integration-browser/results.json'}]],
 use:{viewport:{width:1512,height:982},trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'card-307',testMatch:['numberEditingSmoothness.spec.ts','valueTraceImmediate.spec.ts','numberInputSwitch.spec.ts','pointerSmoothness.spec.ts','wikiDocumentPerformance.spec.ts'],use:{baseURL:'http://127.0.0.1:5573'}},
  {name:'standalone-307',testMatch:['virtualListSmoothness.spec.ts','workspaceSmoothness.spec.ts','retainedCardSwitch.spec.ts'],use:{baseURL:'http://127.0.0.1:5574/card/'}},
  {name:'wiki-307',testMatch:['wikiInteractionSprint.spec.ts','wikiOnly.spec.ts','wikiEnrichment.spec.ts','readingInteractionSmoothness.spec.ts'],timeout:60000,use:{baseURL:'http://127.0.0.1:5575',viewport:{width:1440,height:960}}},
 ],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js --mode standalone --host 127.0.0.1 --port 5573 --strictPort',url:'http://127.0.0.1:5573',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js --config vite.standalone-cloud.config.ts --mode standalone --host 127.0.0.1 --port 5574 --strictPort',url:'http://127.0.0.1:5574/card/',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js preview --config vite.wiki.config.ts --host 127.0.0.1 --port 5575 --strictPort',url:'http://127.0.0.1:5575',reuseExistingServer:false},
 ],
});
