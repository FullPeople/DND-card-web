/** Bounded synthetic class-drop comparison. Run only on a permitted browser runner.
 * node tools/profileClassDrops232.mjs
 * Three unprofiled fresh-page samples plus one separate CDP-profiled sample/cell.
 * Original editPerformance232 comparison remains unchanged. No performance gates.
 */
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
const file=fileURLToPath(import.meta.url),root=resolve(dirname(file),'..');
const output=resolve(root,process.env.DND_PERF_OUTPUT||'.local-evidence/class-drop-perf232');
const baseline=process.env.DND_PERF_BASELINE_DIR,candidate=process.env.DND_PERF_CANDIDATE_DIR||'dist-standalone';
export default defineConfig({
 testDir:dirname(file),testMatch:'profileClassDrops232.spec.ts',timeout:120000,workers:1,retries:0,
 reporter:[['list'],['json',{outputFile:resolve(output,'report.json')}]],outputDir:resolve(output,'samples'),
 use:{viewport:{width:1512,height:982},serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:process.env.DND_BROWSER_EXECUTABLE?{executablePath:process.env.DND_BROWSER_EXECUTABLE}:undefined},
 projects:[...(baseline?[{name:'baseline',use:{baseURL:'http://127.0.0.1:5674'}}]:[]),{name:'candidate',use:{baseURL:'http://127.0.0.1:5675'}}],
 webServer:[...(baseline?[{command:`node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5674 --strictPort --outDir ${JSON.stringify(baseline)}`,url:'http://127.0.0.1:5674',reuseExistingServer:false,cwd:root}]:[]),{command:`node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5675 --strictPort --outDir ${JSON.stringify(candidate)}`,url:'http://127.0.0.1:5675',reuseExistingServer:false,cwd:root}],
});
if(process.argv[1]&&resolve(process.argv[1])===file){
 const result=spawnSync(process.execPath,[resolve(root,'tools/profileCharacterEdits232.mjs')],{cwd:root,stdio:'inherit',env:{...process.env,DND_PERF_CONFIG:file,DND_PERF_OUTPUT:output,DND_PERF_RETAIN_BUILDS:resolve(output,'production-assets')}});
 process.exitCode=result.status??1;
}
