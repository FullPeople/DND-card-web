import type {Character} from '../model';
import {sameValue} from '../merge';
import {DOCUMENT_ROOTS,ENTITY_COLLECTIONS,RESOURCE_COLLECTION,type Operation} from './protocol';
import {applyCanonicalOperations,escapePointer,parsePointer,readPath} from './operations';
/**
 * Turn one explicit user edit into canonical operations. Values are `set`
 * unless the caller declares an increment intent for that exact path; a typed
 * 16 is never guessed to be `inc 6`. Registered arrays are addressed by ID,
 * resources by map key, and every other array is replaced as a whole leaf.
 */
export interface EditIntent { inc?: readonly string[] }
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const collections=new Set<string>(ENTITY_COLLECTIONS);
const MAX_DEPTH=24;
function diffValue(path:string,before:unknown,after:unknown,inc:Set<string>,out:Operation[],depth:number){
  if(sameValue(before,after))return;
  if(after===undefined){out.push({op:'unset',path});return;}
  if(before===undefined){out.push({op:'set',path,value:structuredClone(after)});return;}
  if(path===RESOURCE_COLLECTION&&plain(before)&&plain(after))return diffResources(before,after,inc,out);
  if(plain(before)&&plain(after)&&depth<MAX_DEPTH){
    for(const key of new Set([...Object.keys(before),...Object.keys(after)]))diffValue(path+'/'+escapePointer(key),before[key],after[key],inc,out,depth+1);
    return;
  }
  if(inc.has(path)&&typeof before==='number'&&typeof after==='number'&&Number.isFinite(after-before)){out.push({op:'inc',path,value:after-before});return;}
  out.push({op:'set',path,value:structuredClone(after)});
}
function diffResources(before:Record<string,any>,after:Record<string,any>,inc:Set<string>,out:Operation[]){
  for(const id of Object.keys(before))if(after[id]===undefined)out.push({op:'entity.delete',path:RESOURCE_COLLECTION,entityId:id});
  for(const [id,row] of Object.entries(after)){
    if(row===undefined)continue;
    if(before[id]===undefined||!plain(before[id])||!plain(row))out.push({op:'entity.upsert',path:RESOURCE_COLLECTION,entityId:id,value:structuredClone(row)});
    else diffValue(RESOURCE_COLLECTION+'/'+escapePointer(id),before[id],row,inc,out,3);
  }
}
const rowsOf=(value:unknown):any[]=>Array.isArray(value)?value.filter(row=>plain(row)&&typeof row.id==='string'):[];
function diffRows(collection:string,before:unknown,after:unknown,inc:Set<string>,out:Operation[]){
  const path='/'+collection,old=rowsOf(before),next=rowsOf(after);
  const oldById=new Map(old.map(row=>[row.id,row])),nextIds=new Set(next.map(row=>row.id));
  for(const row of old)if(!nextIds.has(row.id))out.push({op:'entity.delete',path,entityId:row.id});
  for(const row of next){
    const previous=oldById.get(row.id);
    if(!previous)out.push({op:'entity.upsert',path,entityId:row.id,value:structuredClone(row)});
    else if(!sameValue(previous,row))for(const key of new Set([...Object.keys(previous),...Object.keys(row)]))if(key!=='id')diffValue(`${path}/entities/${escapePointer(row.id)}/${escapePointer(key)}`,previous[key],row[key],inc,out,4);
  }
}
/** Raw differences between two documents; parents exist in `before`. */
export function diffDocuments(before:Character,after:Character,intent:EditIntent={}):Operation[]{
  const inc=new Set(intent.inc||[]),out:Operation[]=[];
  for(const root of DOCUMENT_ROOTS){
    const b=(before as any)[root],a=(after as any)[root];
    if(collections.has(root))diffRows(root,b,a,inc,out);
    else diffValue('/'+root,b,a,inc,out,1);
  }
  return out;
}
const ids=(rows:unknown)=>rowsOf(rows).map(row=>row.id as string);
/** Moves turning `current` into `target` (same members), keeping the longest already-ordered run. */
export function orderMoves(path:string,current:string[],target:string[]):Operation[]{
  if(sameValue(current,target))return [];
  const position=new Map(current.map((id,i)=>[id,i])),seq=target.map(id=>position.get(id)!);
  // Longest increasing subsequence of current positions: those rows stay put.
  const tails:number[]=[],prev=new Array(seq.length).fill(-1),tailIdx:number[]=[];
  seq.forEach((value,i)=>{let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>1;if(tails[mid]<value)lo=mid+1;else hi=mid;}tails[lo]=value;tailIdx[lo]=i;prev[i]=lo?tailIdx[lo-1]:-1;});
  const keep=new Set<number>();for(let i=tailIdx[tails.length-1];i>=0;i=prev[i])keep.add(i);
  const out:Operation[]=[],work=[...current];
  for(let i=target.length-1;i>=0;i--){
    if(keep.has(i))continue;
    const entityId=target[i],beforeId=target[i+1]??null;
    out.push({op:'order.move',path,entityId,beforeId});
    work.splice(work.indexOf(entityId),1);
    if(beforeId===null)work.push(entityId);else work.splice(work.indexOf(beforeId),0,entityId);
  }
  if(sameValue(work,target))return out;
  return target.map(entityId=>({op:'order.move',path,entityId,beforeId:null}));
}
function promote(op:Operation,working:Character,next:Character):Operation|undefined{
  if(op.op==='entity.delete')return undefined;
  if(op.op==='entity.upsert'||op.op==='order.move')return undefined;
  const parts=parsePointer(op.path);
  if(collections.has(parts[0])){
    const row=rowsOf((next as any)[parts[0]]).find(r=>r.id===parts[2]);
    if(!rowsOf((working as any)[parts[0]]).some(r=>r.id===parts[2]))return row?{op:'entity.upsert',path:'/'+parts[0],entityId:parts[2],value:structuredClone(row)}:undefined;
  }
  // Climb to the deepest existing object parent and set the edited branch there.
  for(let length=parts.length;length>=1;length--){
    const parentPath=length>1?'/'+parts.slice(0,length-1).map(escapePointer).join('/'):'';
    const parent=parentPath?readPath(working,parentPath):{exists:true,value:working};
    if(!parent.exists||!plain(parent.value))continue;
    if(collections.has(parts[0])&&length<4)return undefined;
    const branch='/'+parts.slice(0,length).map(escapePointer).join('/'),value=readPath(next,branch);
    // An unset beneath a branch the server never had is already satisfied.
    return value.exists?{op:'set',path:branch,value:structuredClone(value.value)}:undefined;
  }
  return undefined;
}
function tryApply(working:Character,op:Operation):Character|undefined{try{return applyCanonicalOperations(working,[op]);}catch{return undefined;}}
/**
 * Operations for an edit from `base` to `next`, anchored on the document the
 * server will see (`server`: confirmed plus earlier pending intents). `base`
 * may carry UI hydration that is not part of the user's intent; such branches
 * are only uploaded when the edit writes beneath them.
 */
export function buildOperations({server,base=server,next,intent}:{server:Character;base?:Character;next:Character;intent?:EditIntent}):Operation[]{
  let working=server;const out:Operation[]=[];
  for(const raw of diffDocuments(base,next,intent)){
    if(raw.op==='entity.delete'&&!readPath(working,raw.path==='/runtime/resources'?raw.path+'/'+escapePointer(raw.entityId):raw.path+'/entities/'+escapePointer(raw.entityId)).exists)continue;
    let op:Operation|undefined=raw;
    if(op.op==='set'&&sameValue(readPath(working,op.path).value,op.value)&&readPath(working,op.path).exists)continue;
    if(op.op==='unset'&&!readPath(working,op.path).exists)continue;
    if(op.op==='inc'&&typeof readPath(working,op.path).value!=='number'){const value=readPath(next,op.path);op=value.exists?{op:'set',path:op.path,value:value.value}:undefined;}
    let applied=op&&tryApply(working,op);
    if(op&&!applied){op=promote(op,working,next);if(op&&op.op==='set'&&sameValue(readPath(working,op.path).value,op.value)&&readPath(working,op.path).exists)continue;applied=op&&tryApply(working,op);}
    if(op&&applied){working=applied;out.push(op);}
  }
  for(const collection of ENTITY_COLLECTIONS){
    const present=new Set(ids((working as any)[collection]));
    const intended=ids((next as any)[collection]).filter(id=>present.has(id)),previous=ids((base as any)[collection]).filter(id=>intended.includes(id));
    // Hydration-only order differences are not user intent.
    if(sameValue(previous,intended.filter(id=>previous.includes(id)))&&previous.length===intended.length)continue;
    const current=ids((working as any)[collection]).filter(id=>intended.includes(id));
    for(const move of orderMoves('/'+collection,current,intended)){const applied=tryApply(working,move);if(applied){working=applied;out.push(move);}}
  }
  return out;
}
