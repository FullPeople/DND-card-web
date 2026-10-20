import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',outputDir:'.local-evidence/wiki-identities',workers:1,timeout:60000,expect:{timeout:12000},
 reporter:[['list'],['json',{outputFile:'.local-evidence/wiki-identities/report.json'}]],
 use:{channel:process.env.CI?undefined:'msedge',serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'wiki-identities',testMatch:'wikiRecordIdentities.spec.ts',use:{baseURL:'http://127.0.0.1:5213'}},
  {name:'card-identities',testMatch:'wikiRecordIdentityCard.spec.ts',use:{baseURL:'http://127.0.0.1:5214'}}
 ],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js preview --config vite.wiki.config.ts --host 127.0.0.1 --port 5213 --strictPort',url:'http://127.0.0.1:5213',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5214 --strictPort',url:'http://127.0.0.1:5214',reuseExistingServer:false}
 ]
});
