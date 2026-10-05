import {defineConfig} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const audit=JSON.parse(readFileSync('dist-standalone/assets/automation-progress.audit.json','utf8'));
const bytes=readFileSync('dist-standalone/'+audit.manifest[0].file),manifest=JSON.parse(bytes.toString());
const automationArtifact={sourceCommit:manifest.build.sourceCommit,fingerprint:manifest.build.fingerprint,mode:manifest.build.mode,manifestSha256:createHash('sha256').update(bytes).digest('hex')};
export default defineConfig({metadata:{automationArtifact},testDir:'./tests/e2e',testMatch:['automationProgress.spec.ts','announcement.spec.ts',...(process.env.DND_PROGRESS_MECHANISM_QA==='1'?['automation209.spec.ts','featureArmor.spec.ts','sourceChoices232.spec.ts','sourceSpellMechanics217.spec.ts','spellWorkspace210.spec.ts']:[])],outputDir:'.local-evidence/automation-progress/browser',timeout:45000,workers:1,reporter:[['list'],['json',{outputFile:'.local-evidence/automation-progress/browser-report.json'}]],use:{serviceWorkers:'block',baseURL:'http://127.0.0.1:5196',viewport:{width:1440,height:960},launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},webServer:{command:'node node_modules/vite/bin/vite.js preview --mode standalone --host 127.0.0.1 --port 5196',url:'http://127.0.0.1:5196',reuseExistingServer:false}});
