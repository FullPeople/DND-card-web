import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const remote='https://github.com/FullPeople/dnd5e-automation-data.git',artifact='reports/progress/runtime-coverage.json';
export function verifyCommittedRuntimeCoverage(repository:string,lock:{repository:string;revision:string;path:string;sha256:string},bytes:Buffer){
 if(lock.repository!=='FullPeople/dnd5e-automation-data'||lock.path!==artifact||!/^[a-f0-9]{40}$/.test(lock.revision)||bytes.length>16*1024*1024||!/^[a-f0-9]{64}$/.test(lock.sha256)||createHash('sha256').update(bytes).digest('hex')!==lock.sha256)throw Error('Invalid runtime artifact identity');
 const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:repository,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1'},maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
 if(![remote,remote.slice(0,-4),'git@github.com:FullPeople/dnd5e-automation-data.git'].includes(git('config','--get','remote.origin.url').toString().trim()))throw Error('Runtime artifact checkout has the wrong origin');
 if(git('rev-parse','--verify',lock.revision+'^{commit}').toString().trim()!==lock.revision||!/^100644 blob [a-f0-9]{40}\t/.test(git('ls-tree',lock.revision,'--',artifact).toString())||!git('cat-file','blob',lock.revision+':'+artifact).equals(bytes))throw Error('Runtime Data commit blob differs from the Web copy');
 return {verified:true,repository:lock.repository,revision:lock.revision,path:artifact,sha256:lock.sha256,bytes:bytes.length};
}
export function verifyRemoteRuntimeCoverage(lock:{repository:string;revision:string;path:string;sha256:string},bytes:Buffer){
 if(lock.repository!=='FullPeople/dnd5e-automation-data'||lock.path!==artifact||!/^[a-f0-9]{40}$/.test(lock.revision))throw Error('Invalid runtime artifact identity');
 const root=mkdtempSync(join(tmpdir(),'runtime-coverage-'));try{const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:60000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});git('init','-q');git('remote','add','origin',remote);git('fetch','--no-tags','--depth=1','--filter=blob:none','origin',lock.revision);git('cat-file','blob',lock.revision+':'+artifact);return verifyCommittedRuntimeCoverage(root,lock,bytes);}finally{rmSync(root,{recursive:true,force:true});}
}
