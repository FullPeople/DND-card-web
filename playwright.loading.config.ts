import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const homeRoot=process.env.DND_HOME_ROOT||fileURLToPath(new URL('./site/homepage',import.meta.url));
const home=existsSync(homeRoot+'/package.json');
export default defineConfig({
 testDir:'./tests',timeout:40000,workers:1,reporter:[['list'],['json',{outputFile:'.local-evidence/loading/browser-results.json'}]],
 outputDir:'test-results-performance-loading',use:{channel:process.env.CI?undefined:'msedge',viewport:{width:1440,height:960},serviceWorkers:'block',trace:'retain-on-failure',launchOptions:process.env.CI?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:undefined},
 projects:[
  {name:'standalone',testMatch:['**/loadingSmooth.spec.ts','**/startupNoticeOrder.spec.ts','**/startup228.spec.ts','**/startupTail241.spec.ts','**/resourceDashboard220App.spec.ts'],use:{baseURL:'http://127.0.0.1:5311'}},
  {name:'wiki',testMatch:['**/wikiOnly.spec.ts','**/wikiEnrichment.spec.ts','**/wikiLoadingSmooth.spec.ts'],use:{baseURL:'http://127.0.0.1:5312'}},
  ...(home?[{name:'home',testMatch:'**/homeLoadingSmooth.spec.ts',use:{baseURL:'http://127.0.0.1:5310'}}]:[])
 ],
 webServer:[
  {command:'node node_modules/vite/bin/vite.js preview --mode standalone --port 5311 --strictPort',url:'http://127.0.0.1:5311',reuseExistingServer:!process.env.CI},
  {command:'node node_modules/vite/bin/vite.js preview --config vite.wiki.config.ts --port 5312 --strictPort',url:'http://127.0.0.1:5312',reuseExistingServer:!process.env.CI},
  ...(home?[{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5310 --strictPort',cwd:homeRoot,url:'http://127.0.0.1:5310',reuseExistingServer:!process.env.CI}]:[])
 ]
});
