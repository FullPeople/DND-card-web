import {APP_VERSION,announcementVersionFor} from './announcement';

// Shareable diagnostics are an allowlist, never a serialization of an Error,
// document, URL, transport response or authentication object.
type Fields=Record<string,unknown>;
export type WorkbenchDiagnosticContext={operation?:string;connection?:unknown;version?:string;at?:string};
const field=(source:unknown,key:string):unknown=>{
 if(!source||typeof source!=='object')return undefined;
 try{const descriptor=Object.getOwnPropertyDescriptor(source,key);return descriptor&&'value' in descriptor?descriptor.value:undefined;}catch{return undefined;}
};
const identifier=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)?value:undefined;
const word=(value:unknown)=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)?value:undefined;
const version=(value:unknown)=>typeof value==='string'&&/^(?:standalone-)?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]{1,32})?$/.test(value)?value:undefined;
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER?value:undefined;
const boolean=(value:unknown)=>typeof value==='boolean'?value:undefined;
const status=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&(value===0||value>=100&&value<=599)?value:undefined;
const timestamp=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))?value:undefined;
const put=(target:Fields,key:string,value:unknown)=>{if(value!==undefined)target[key]=value;};
const timingKeys=['queueMs','readMs','fetchMs','loadMs','saveMs','writeMs','persistMs','projectMs','projectionMs','totalMs','durationMs','elapsedMs','serializeMs','postMs','handlerMs','hostMs','transportMs','applyMs','decodeMs','mergeMs','ackMs'] as const;
function timings(source:unknown){const result:Fields={};for(const key of timingKeys)put(result,key,number(field(source,key)));return result;}
function operation(source:unknown){
 const result:Fields={};
 for(const key of ['code','phase','operation'] as const)put(result,key,word(field(source,key)));
 for(const key of ['requestId','correlationId'] as const)put(result,key,identifier(field(source,key)));
 for(const key of ['retryable','uncertain','permissionChanged','queueBlocked'] as const)put(result,key,boolean(field(source,key)));
 put(result,'version',version(field(source,'version')));put(result,'status',status(field(source,'status'))??status(field(source,'httpStatus')));
 const timing=timings(field(source,'timing'));if(Object.keys(timing).length)result.timing=timing;
 return result;
}
function history(source:unknown,pending=false){
 if(!Array.isArray(source))return undefined;
 // Do not follow arbitrary object graphs or invoke caller-defined toJSON/getters.
 const result:Fields[]=[];for(let i=Math.max(0,source.length-24);i<source.length;i++){
  const row=field(source,String(i)),item:Fields={};put(item,pending?'id':'requestId',identifier(field(row,pending?'id':'requestId')));put(item,'type',word(field(row,'type')));
  if(pending)put(item,'elapsedMs',number(field(row,'elapsedMs')));else{put(item,'ok',boolean(field(row,'ok')));Object.assign(item,timings(row));const timing=timings(field(row,'timing'));if(Object.keys(timing).length)item.timing=timing;}
  if(Object.keys(item).length)result.push(item);
 }return result;
}
export function safeWorkbenchConnection(source:unknown){
 const result:Fields={};put(result,'online',boolean(field(source,'online')));
 const transport=field(source,'transport');if(transport==='direct'||transport==='relay'||transport==='offline')result.transport=transport;
 put(result,'hostStarted',number(field(source,'hostStarted')));
 const cache=field(source,'cache'),summary:Fields={};put(summary,'confirmed',boolean(field(cache,'confirmed')));put(summary,'epoch',number(field(cache,'epoch')));if(Object.keys(summary).length)result.cache=summary;
 const relay=field(source,'relayState'),relaySummary:Fields={};put(relaySummary,'status',status(field(relay,'status')));put(relaySummary,'retryAt',number(field(relay,'retryAt')));if(Object.keys(relaySummary).length)result.relayState=relaySummary;
 put(result,'pending',history(field(source,'pending'),true));put(result,'recent',history(field(source,'recent')));return result;
}
export function safeWorkbenchDiagnostic(error:unknown,context:WorkbenchDiagnosticContext={}){
 const diagnostic=field(error,'diagnostic'),details=operation(diagnostic),result:Fields={product:'Full Suite',at:timestamp(context.at)||timestamp(field(error,'at'))||new Date().toISOString(),version:version(context.version)||version(field(error,'version'))||announcementVersionFor('suite'),clientVersion:APP_VERSION,...operation(error)};
 put(result,'operation',word(context.operation)||field(result,'operation')||field(details,'operation'));
 put(result,'requestId',field(result,'requestId')||field(details,'requestId'));
 const connection=safeWorkbenchConnection(field(diagnostic,'connection'));if(Object.keys(connection).length)details.connection=connection;
 const outerConnection=safeWorkbenchConnection(context.connection??field(error,'connection')??error);if(Object.keys(outerConnection).length)result.connection=outerConnection;
 if(Object.keys(details).length)result.diagnostic=details;return result;
}
