import type {Character} from '../model';
import {DOCUMENT_ROOTS,ENTITY_COLLECTIONS,PROTECTED_ROOTS,RESOURCE_COLLECTION,type Operation} from './protocol';
/**
 * Pure client mirror of the server Operation v1 reducer. It is shared by the
 * optimistic projection and the replay of confirmed server results, so it must
 * match docs/protocol/OPERATIONS.md exactly and never address array indexes.
 */
export class OperationError extends Error { constructor(public code:'invalid_path'|'invalid_operation',message:string){super(message);} }
const UNSAFE=new Set(['__proto__','prototype','constructor']);
const collections=new Set<string>(ENTITY_COLLECTIONS),protectedRoots=new Set<string>(PROTECTED_ROOTS),roots=new Set<string>(DOCUMENT_ROOTS);
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const escapePointer=(segment:string)=>segment.replaceAll('~','~0').replaceAll('/','~1');
export const pointer=(...segments:string[])=>'/'+segments.map(escapePointer).join('/');
export function parsePointer(path:string):string[]{
  if(typeof path!=='string'||path.length<2||new TextEncoder().encode(path).length>4096||path[0]!=='/')throw new OperationError('invalid_path','path must be a non-root JSON pointer');
  const parts=path.slice(1).split('/');
  if(parts.length>32)throw new OperationError('invalid_path','path too deep');
  return parts.map(raw=>{
    if(/~(?![01])/.test(raw))throw new OperationError('invalid_path','invalid pointer escape');
    const segment=raw.replaceAll('~1','/').replaceAll('~0','~');
    if(!segment||UNSAFE.has(segment))throw new OperationError('invalid_path','unsafe or empty path segment');
    return segment;
  });
}
/** Paths an operation touches, identical to the server's conflict detection. */
export function operationPaths(op:Operation):string[]{
  if(op.op==='entity.upsert'||op.op==='entity.delete'||op.op==='order.move'){
    const rows=collections.has(op.path.slice(1));
    const own=op.path+(rows?'/entities/':'/')+escapePointer(op.entityId);
    if(op.op!=='order.move')return [own];
    return [own,op.path+'/order',...(op.beforeId?[op.path+'/entities/'+escapePointer(op.beforeId)]:[])];
  }
  return [op.path];
}
export const pathOverlap=(a:string,b:string)=>a===b||a.startsWith(b+'/')||b.startsWith(a+'/');
const clone=<T,>(v:T):T=>v===undefined?v:structuredClone(v);
function entityOperation(document:Record<string,any>,op:Extract<Operation,{entityId:string}>){
  if(typeof op.entityId!=='string'||!op.entityId||op.entityId.length>2000)throw new OperationError('invalid_operation','entityId required');
  parsePointer('/'+escapePointer(op.entityId));
  const parts=parsePointer(op.path);
  if(parts.length===1&&collections.has(parts[0])){
    let rows=document[parts[0]];
    if(rows!==undefined&&!Array.isArray(rows))throw new OperationError('invalid_path','collection must be an array');
    if(rows===undefined){if(op.op==='entity.delete')return;rows=document[parts[0]]=[];}
    const at=rows.findIndex((row:any)=>row?.id===op.entityId);
    if(op.op==='entity.upsert'){
      if(!plain(op.value)||op.value.id!==op.entityId)throw new OperationError('invalid_operation','full entity object required with matching id');
      if(at>=0)rows[at]=clone(op.value);else rows.push(clone(op.value));
    }else if(op.op==='entity.delete'){if(at>=0)rows.splice(at,1);}
    else{
      if(at<0)throw new OperationError('invalid_operation','move requires existing array entity');
      const before=op.beforeId??null;
      if(before!==null&&(before===op.entityId||!rows.some((row:any)=>row?.id===before)))throw new OperationError('invalid_operation','invalid beforeId');
      const [row]=rows.splice(at,1);
      if(before===null)rows.push(row);else rows.splice(rows.findIndex((r:any)=>r?.id===before),0,row);
    }
    return;
  }
  if(op.path!==RESOURCE_COLLECTION)throw new OperationError('invalid_path','unregistered entity collection');
  const resources=document.runtime?.resources;
  if(!plain(resources))throw new OperationError('invalid_path','resource collection missing');
  if(op.op==='entity.upsert'){if(!plain(op.value))throw new OperationError('invalid_operation','full entity object required');resources[op.entityId]=clone(op.value);}
  else if(op.op==='entity.delete')delete resources[op.entityId];
  else throw new OperationError('invalid_operation','move requires existing array entity');
}
function parentOf(document:Record<string,any>,parts:string[]):Record<string,any>{
  if(!roots.has(parts[0]))throw new OperationError('invalid_path','unknown root field');
  if(protectedRoots.has(parts[0]))throw new OperationError('invalid_path','server-managed metadata is immutable');
  let current:any=document,rest=parts.slice(0,-1);
  if(collections.has(parts[0])){
    if(parts.length<4||parts[1]!=='entities'||parts[3]==='id')throw new OperationError('invalid_path','use entity operations, or /collection/entities/id/field');
    const rows=document[parts[0]];
    current=Array.isArray(rows)?rows.find((row:any)=>row?.id===parts[2]):undefined;
    rest=parts.slice(3,-1);
    if(!plain(current))throw new OperationError('invalid_path','parent must exist and be an object; array indexes are forbidden');
  }
  for(const key of rest){
    if(!plain(current)||!Object.hasOwn(current,key))throw new OperationError('invalid_path','parent must exist and be an object; array indexes are forbidden');
    current=current[key];
  }
  if(!plain(current))throw new OperationError('invalid_path','parent must exist and be an object; array indexes are forbidden');
  return current;
}
function applyOne(document:Record<string,any>,op:Operation){
  if(op.op==='entity.upsert'||op.op==='entity.delete'||op.op==='order.move')return entityOperation(document,op);
  const parts=parsePointer(op.path),parent=parentOf(document,parts),key=parts[parts.length-1];
  if(op.op==='set'){if(!('value' in op))throw new OperationError('invalid_operation','set requires value');parent[key]=clone(op.value);}
  else if(op.op==='unset')delete parent[key];
  else if(op.op==='inc'){
    const sum=parent[key]+op.value;
    if(typeof parent[key]!=='number'||typeof op.value!=='number'||!Number.isFinite(sum)||Math.abs(sum)>Number.MAX_SAFE_INTEGER)throw new OperationError('invalid_operation','inc needs existing safe finite numeric field and numeric value');
    parent[key]=sum;
  }else throw new OperationError('invalid_operation','unknown operation');
}
/** Apply one batch atomically. The input document is never mutated. */
export function applyCanonicalOperations<T extends Character|Record<string,any>>(document:T,operations:readonly Operation[]):T{
  const draft=structuredClone(document) as Record<string,any>;
  for(const op of operations)applyOne(draft,op);
  return draft as T;
}
/** Read a canonical path from a document. Missing differs from JSON null. */
export function readPath(document:unknown,path:string):{exists:boolean;value?:unknown}{
  let parts:string[];try{parts=parsePointer(path);}catch{return {exists:false};}
  let current:any=document;
  for(let i=0;i<parts.length;i++){
    const key=parts[i];
    if(i===1&&collections.has(parts[0])&&key==='entities'&&Array.isArray(current)){
      const row=current.find((r:any)=>r?.id===parts[i+1]);if(!row)return {exists:false};current=row;i++;continue;
    }
    if(!plain(current)||!Object.hasOwn(current,key))return {exists:false};
    current=current[key];
  }
  return {exists:true,value:current};
}
