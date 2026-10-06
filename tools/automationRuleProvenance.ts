// Build/import checks only. No rules or repository access enters the browser.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {RULE_AUTHORITY,type SnapshotLock} from './automationRuleSnapshot.ts';

const ARTIFACT_PATH='reports/progress/automation-rule-status.json';
const REMOTE=`https://github.com/${RULE_AUTHORITY}.git`;
const LIMIT=16*1024*1024;
const localEnv={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1'};

/** Compare Git's committed blob, never the checkout (which may convert LF). */
export function verifyCommittedRuleSnapshot(repository:string,lock:SnapshotLock,bytes:Buffer){
 if(lock.repository!==RULE_AUTHORITY||lock.path!==ARTIFACT_PATH||!/^[a-f0-9]{40}$/.test(lock.revision)||!/^[a-f0-9]{64}$/.test(lock.sha256))throw Error('Invalid committed artifact identity');
 if(bytes.length>LIMIT||createHash('sha256').update(bytes).digest('hex')!==lock.sha256)throw Error('Local artifact does not match its version lock');
 const git=(...args:string[])=>execFileSync('git',['--no-replace-objects',...args],{cwd:repository,env:localEnv,maxBuffer:LIMIT,stdio:['ignore','pipe','pipe']});
 const origin=git('config','--get','remote.origin.url').toString().trim();
 if(![REMOTE,REMOTE.slice(0,-4),`git@github.com:${RULE_AUTHORITY}.git`,`ssh://git@github.com/${RULE_AUTHORITY}.git`].includes(origin))throw Error('Data checkout origin does not match the declared authority');
 try{
  if(git('rev-parse','--verify',`${lock.revision}^{commit}`).toString().trim()!==lock.revision)throw Error('commit identity');
  const tree=git('ls-tree',lock.revision,'--',ARTIFACT_PATH).toString().trim();
  if(!/^100644 blob [a-f0-9]{40}\t/.test(tree))throw Error('artifact must be a regular committed file');
  const size=Number(git('cat-file','-s',`${lock.revision}:${ARTIFACT_PATH}`).toString().trim());
  if(!Number.isSafeInteger(size)||size>LIMIT||size!==bytes.length)throw Error('artifact byte size differs');
  if(!git('cat-file','blob',`${lock.revision}:${ARTIFACT_PATH}`).equals(bytes))throw Error('artifact bytes differ');
 }catch(cause){throw new Error('Data commit artifact verification failed; no matching committed blob was verified',{cause});}
 return {schemaVersion:1,repository:RULE_AUTHORITY,exportRevision:lock.revision,artifactPath:ARTIFACT_PATH,artifactSha256:lock.sha256,artifactBytes:bytes.length,sourceRevision:lock.sourceRevision,scope:'export-commit-blob-only',originalReviewChain:'not-replayed',retrieval:'local-git'};
}

/** Fetch the pinned public export commit, not a moving branch or the old review chain. */
export function verifyRemoteRuleSnapshot(lock:SnapshotLock,bytes:Buffer){
 // Validate before making any network request or passing a revision to Git.
 if(lock.repository!==RULE_AUTHORITY||!/^[a-f0-9]{40}$/.test(lock.revision))throw Error('Invalid remote artifact identity');
 const temp=mkdtempSync(join(tmpdir(),'automation-source-'));
 try{
  const git=(...args:string[])=>execFileSync('git',args,{cwd:temp,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:60000,maxBuffer:LIMIT,stdio:['ignore','pipe','pipe']});
  try{
   git('init','-q');git('remote','add','origin',REMOTE);
   git('fetch','--no-tags','--depth=1','--filter=blob:none','origin',lock.revision);
   // A partial clone acquires only this public blob on demand. Later comparison
   // disables lazy fetching so an absent object cannot silently become a pass.
   git('cat-file','blob',`${lock.revision}:${ARTIFACT_PATH}`);
  }catch(cause){throw new Error('Remote Data artifact verification unavailable: fetch/read failed; verification is missing',{cause});}
  return {...verifyCommittedRuleSnapshot(temp,lock,bytes),retrieval:'fresh-remote-fetch'};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
