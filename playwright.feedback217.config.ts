import {defineConfig} from '@playwright/test';
const standalone=process.env.DND_217_STANDALONE_DIST||'dist-standalone';
export default defineConfig({
 testDir:'./tests/e2e',outputDir:process.env.DND_217_RESULTS||'test-results-feedback217',timeout:60000,expect:{timeout:10000},workers:1,forbidOnly:!!process.env.CI,reporter:'list',
 use:{channel:process.env.CI?undefined:'msedge',viewport:{width:1512,height:982},screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'standalone',testMatch:['feedback217.spec.ts','customRoundtrip217.spec.ts'],use:{baseURL:'http://127.0.0.1:5256'}},
  {name:'integrated',testMatch:['resourceWidgets217.spec.ts','sourceSpellMechanics217.spec.ts','workbench-instant217.spec.ts','groupRoll217.spec.ts','card-atmosphere.spec.ts'],use:{baseURL:'http://127.0.0.1:5257'}}
 ],
 webServer:[
  {command:`node node_modules/vite/bin/vite.js preview --mode standalone --outDir "${standalone}" --host 127.0.0.1 --port 5256 --strictPort`,url:'http://127.0.0.1:5256',reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5257 --strictPort',url:'http://127.0.0.1:5257',reuseExistingServer:false}
 ]
});
