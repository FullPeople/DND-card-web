import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validSourceDirectory,type SourceDirectory} from '../src/platform/sourceDirectory.ts';
export const SOURCE_DISCOVERY_PATH='docs/data/catalog-source-discovery.json',SOURCE_DISCOVERY_LOCK='docs/data/catalog-source-discovery.lock.json';
const artifact='reports/progress/catalog-source-discovery.json',repository='FullPeople/dnd5e-automation-data',remote=`https://github.com/${repository}.git`,limit=1024*1024;
type Lock={schemaVersion:1;repository:string;revision:string;path:string;sha256:string};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
function validLock(lock:Lock,bytes:Buffer){if(lock.schemaVersion!==1||lock.repository!==repository||lock.path!==artifact||!/^[a-f0-9]{40}$/.test(lock.revision)||!/^[a-f0-9]{64}$/.test(lock.sha256)||bytes.length>limit||sha(bytes)!==lock.sha256)throw Error('Invalid source-directory authority lock');}
export function catalogSourceDiscovery(root:string){
 const bytes=readFileSync(join(root,SOURCE_DISCOVERY_PATH)),lock=JSON.parse(readFileSync(join(root,SOURCE_DISCOVERY_LOCK),'utf8')) as Lock;validLock(lock,bytes);const value=JSON.parse(bytes.toString());
 if(value.schemaVersion!==1||value.definition!=='discovered directory; no source-review, modeling, execution or acceptance credit'||value.sourceBodiesPublished!==false||!Array.isArray(value.sources)||value.counts?.sources!==value.sources.length||!value.creditAdded||Object.keys(value.creditAdded).length!==4||!['sourceReviewed','modeled','executed','accepted'].every(key=>value.creditAdded[key]===0))throw Error('Source discovery cannot add rule execution credit');
 const diagnostics=value.diagnostics?.counts;if(!diagnostics||typeof diagnostics!=='object'||Array.isArray(diagnostics)||Object.entries(diagnostics).some(([key,count])=>!['identity-unresolved','duplicate-conflict'].includes(key)||!Number.isSafeInteger(count)||Number(count)<0)||!Array.isArray(value.unclassifiedExtraFiles))throw Error('Unknown source-directory diagnostic state');
 const directory:SourceDirectory={schemaVersion:1,revision:lock.revision,reportSha256:lock.sha256,legacySnapshotSha256:value.legacySnapshotSha256,generatedAt:value.generatedAt,summary:{sources:value.sources.length,legacyRegisteredIdentities:value.counts.legacyRegisteredIdentities,newCandidateIdentities:value.counts.newCandidateIdentities,provisionalCombinedIdentities:value.counts.provisionalCombinedIdentities,identityUnresolved:diagnostics['identity-unresolved']??0,duplicateConflicts:diagnostics['duplicate-conflict']??0,unclassifiedFiles:value.unclassifiedExtraFiles.length},creditAdded:{sourceReviewed:0,modeled:0,executed:0,accepted:0},sources:value.sources.map((source:any)=>({id:source.id,name:source.name}))};
 if(!validSourceDirectory(directory))throw Error('Invalid public source directory');return {bytes,lock,directory};
}
export function verifyCommittedSourceDirectory(dataRoot:string,lock:Lock,bytes:Buffer){
 validLock(lock,bytes);const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:dataRoot,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1'},maxBuffer:limit,stdio:['ignore','pipe','pipe']});
 if(![remote,remote.slice(0,-4),`git@github.com:${repository}.git`,`ssh://git@github.com/${repository}.git`].includes(git('config','--get','remote.origin.url').toString().trim()))throw Error('Source-directory checkout has the wrong origin');
 if(git('rev-parse','--verify',lock.revision+'^{commit}').toString().trim()!==lock.revision||!/^100644 blob [a-f0-9]{40}\t/.test(git('ls-tree',lock.revision,'--',artifact).toString())||!git('cat-file','blob',lock.revision+':'+artifact).equals(bytes))throw Error('Source-directory Data commit blob differs from the Web copy');
 return {verified:true,repository,revision:lock.revision,path:artifact,sha256:lock.sha256,bytes:bytes.length};
}
export function verifyRemoteSourceDirectory(lock:Lock,bytes:Buffer){
 validLock(lock,bytes);const base=resolve(tmpdir()),root=mkdtempSync(join(base,'source-directory-'));try{
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:60000,maxBuffer:limit,stdio:['ignore','pipe','pipe']});git('init','-q');git('remote','add','origin',remote);git('fetch','--no-tags','--depth=1','--filter=blob:none','origin',lock.revision);git('cat-file','blob',lock.revision+':'+artifact);return verifyCommittedSourceDirectory(root,lock,bytes);
 }finally{if(dirname(resolve(root))!==base||!basename(root).startsWith('source-directory-'))throw Error('Unsafe temporary source-directory cleanup');rmSync(root,{recursive:true,force:true});}
}
