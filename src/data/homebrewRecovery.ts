import type {Raw} from '../core/model';
import {withRequestTimeout} from '../platform/requestTimeout';
import {catalogTransport} from './catalogTransport';
import {homebrewPaths} from './homebrew';

/** Same-language deployment repository, verified against the mirror's generated source index. */
export const HOMEBREW_DEPLOY_SOURCE='https://raw.githubusercontent.com/tjliqy/homebrew-deploy/main';
export type RecoveredHomebrew={body:Raw;etag:string|null;recoveredFrom:string};

export function homebrewRecovery(index:Raw,signal:AbortSignal){
 const paths=new Set(homebrewPaths(index));
 return async(path:string):Promise<RecoveredHomebrew>=>{
  const expected=Object.entries(index).filter(([,value])=>value===path).map(([id])=>id.trim().toUpperCase());
  if(!paths.has(path)||!expected.length)throw Error('原仓库恢复需要有效索引中的明确来源');
  return withRequestTimeout(8000,signal,async recoverySignal=>{
   // A failed backup origin cannot pause readers of the primary mirror.
   const encoded=path.split('/').map(encodeURIComponent).join('/');
   const result=await catalogTransport(recoverySignal).json(`${HOMEBREW_DEPLOY_SOURCE}/${encoded}`);
   const declared=new Set((Array.isArray(result.body._meta?.sources)?result.body._meta.sources:[])
    .filter((source:Raw)=>typeof source?.json==='string').map((source:Raw)=>source.json.trim().toUpperCase()));
   if(!expected.every(id=>declared.has(id)))throw Error('原仓库资料的来源身份与镜像索引不一致');
   if(!Object.entries(result.body).some(([key,value])=>key!=='_meta'&&Array.isArray(value)&&value.length))throw Error('原仓库资料没有可读取的正文');
   return {...result,recoveredFrom:HOMEBREW_DEPLOY_SOURCE};
  });
 };
}
