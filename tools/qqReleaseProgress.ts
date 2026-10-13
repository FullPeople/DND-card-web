import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';
import {automationProgressPlugin} from './automationProgressPlugin';

/** One authorized cloud-only release; default builds keep the full source guard. */
export function qqReleaseProgress(sourceRoot=process.cwd()):Plugin{
 const path=process.env.DND_QQ286_RELEASE_EXCEPTION;
 if(!path)return automationProgressPlugin(sourceRoot);
 const policy=JSON.parse(readFileSync(path,'utf8')),baseline=resolve(policy.baselineRoot);
 const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 if(policy.release!=='qq-permissions286-20261012'||policy.skipFullReplay!==true||policy.userAuthorized!==true||policy.baseCommit!=='c52eaa2b2e53bd2ff110ac5974865c4e284f3021'||policy.sourceCommit!==git(sourceRoot,'rev-parse','HEAD')||git(baseline,'rev-parse','HEAD')!==policy.baseCommit)throw Error('Not the authorized QQ 286 release');
 if(git(sourceRoot,'diff','--name-only',policy.baseCommit,'--','src/core','src/data','tools/automationRuntimeCoverage.ts','tools/automationProgress.ts','tools/automationProgressPlugin.ts','docs/data'))throw Error('The urgent QQ release must preserve all rule/data implementation and coverage inputs');
 const plugin=automationProgressPlugin(baseline),original=plugin.buildStart;
 plugin.buildStart=function(options){
  if(typeof original==='function')original.call(this,options);else original?.handler.call(this,options);
  this.emitFile({type:'asset',fileName:'release-validation.json',source:JSON.stringify({release:policy.release,sourceCommit:policy.sourceCommit,userAuthorizedFullReplaySkip:true,ruleAndDataCodeUnchanged:true,coverageBaseline:policy.baseCommit,fullReplayRun:false,progressPublicationRecertified:false},null,2)});
 };
 return plugin;
}
