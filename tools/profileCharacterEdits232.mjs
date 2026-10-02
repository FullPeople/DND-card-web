/** Synthetic production-build comparison. No upstream data or user browser is used. */
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const root=process.cwd(),temporary=mkdtempSync(join(tmpdir(),'dnd-edit-perf232-'));
const baseline=join(temporary,'baseline'),candidate=join(temporary,'candidate');mkdirSync(baseline);mkdirSync(candidate);
const baselineRef=process.env.DND_PERF_BASELINE_REF||'79078c1cfb1a1ee4de15e7612a66f720321eaaab';
const baselineSha=execFileSync('git',['rev-parse',baselineRef],{cwd:root,encoding:'utf8'}).trim();
const archive=execFileSync('git',['archive',baselineSha],{cwd:root,maxBuffer:64*1024*1024});
const extraction=spawnSync('tar',['-x','-C',baseline],{input:archive,stdio:['pipe','inherit','inherit']});if(extraction.status!==0)throw Error('Baseline extraction failed');
symlinkSync(resolve(root,'node_modules'),join(baseline,'node_modules'),'dir');
console.log(`Profiling unchanged baseline ${baselineSha} against current working tree; output: ${temporary}`);
execFileSync(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build','--mode','standalone'],{cwd:baseline,stdio:'inherit'});
execFileSync(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build','--mode','standalone','--outDir',candidate],{cwd:root,stdio:'inherit'});
const run=spawnSync(process.execPath,[resolve(root,'node_modules/@playwright/test/cli.js'),'test','--config','playwright.edit-perf232.config.ts'],{cwd:root,stdio:'inherit',env:{...process.env,DND_PERF_BASELINE_DIR:join(baseline,'dist-standalone'),DND_PERF_CANDIDATE_DIR:candidate,DND_PERF_BASELINE_SHA:baselineSha}});
process.exitCode=run.status??1;
