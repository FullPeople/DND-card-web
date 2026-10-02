/** Measures actual baseline/core code with synthetic data; this is not a UI benchmark. */
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {rolldown} from 'rolldown';
const root=process.cwd(),temporary=mkdtempSync(join(tmpdir(),'dnd-core-perf232-')),baseline=join(temporary,'baseline');mkdirSync(baseline);
const baselineSha=execFileSync('git',['rev-parse',process.env.DND_PERF_BASELINE_REF||'79078c1cfb1a1ee4de15e7612a66f720321eaaab'],{cwd:root,encoding:'utf8'}).trim();
const archive=execFileSync('git',['archive',baselineSha],{cwd:root,maxBuffer:64*1024*1024});
const extraction=spawnSync('tar',['-x','-C',baseline],{input:archive,stdio:['pipe','inherit','inherit']});if(extraction.status!==0)throw Error('Baseline extraction failed');
symlinkSync(resolve(root,'node_modules'),join(baseline,'node_modules'),'dir');
const file=join(temporary,'profile.mjs'),output=resolve(process.env.DND_PERF_CORE_OUTPUT||'docs/evidence/direct232/core-performance.json');mkdirSync(dirname(output),{recursive:true});
const bundle=await rolldown({input:resolve(root,'tools/profileCharacterCore232.ts'),platform:'node',plugins:[{name:'fixed-baseline',resolveId(id){if(id.startsWith('direct232-baseline/'))return join(baseline,id.slice('direct232-baseline/'.length)+'.ts');}}]});
await bundle.write({file,format:'esm'});await bundle.close();
execFileSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,DND_PERF_CORE_OUTPUT:output,DND_PERF_BASELINE_SHA:baselineSha}});
