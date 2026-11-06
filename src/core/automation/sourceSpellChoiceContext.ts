import type {Character,Entry,Selection} from '../model';
import {sourceTextSha256} from './sourceTextSha256';

export interface SourceSpellChoiceContextRecord {
 expression:string;
 ownerEntryId:string;
 ownerSnapshotSha256:string;
 entriesSha256:string;
 entries:Entry[];
}
export interface SourceSpellChoiceContexts {version:number;records?:Record<string,SourceSpellChoiceContextRecord>;[key:string]:unknown}
export interface SourceSpellChoiceContextDraft {expression:string;entries:Entry[]}
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function fail():never{throw Error('法表来源记录无法核对，原资料保留。');}
function normalized(value:unknown,depth=0,budget={left:60000}):unknown{
 if(depth>35||--budget.left<0)fail();
 if(value===undefined||value===null)return null;
 if(typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))fail();return value;}
 if(Array.isArray(value))return value.map(item=>normalized(item,depth+1,budget));
 if(!plain(value)||Reflect.ownKeys(value).some(key=>typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)))fail();
 return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,normalized(item,depth+1,budget)]));
}
export const sourceSpellChoiceContextDigest=(value:unknown)=>sourceTextSha256(JSON.stringify(normalized(value)));
function entrySnapshot(value:unknown):value is Entry{
 return plain(value)&&text(value.id,2000)&&text(value.name,300)&&text(value.english,2000)&&text(value.source,80)&&text(value.packId,2000)&&text(value.revision,4000)&&['2014','2024','both'].includes(String(value.edition))&&Array.isArray(value.entries)&&plain(value.raw)&&(value.kind==='class'||value.kind==='rule'&&value.raw._category==='spellList');
}
/** Unknown versions stay opaque. Snapshots authenticate transport, never grant effects by themselves. */
export function validateSourceSpellChoiceContexts(value:unknown,checkEntry?:(entry:Entry)=>void):void{
 if(value===undefined)return;
 if(!plain(value)||!Number.isSafeInteger(value.version)||(value.version as number)<1)fail();
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','records'].includes(key))||!plain(value.records)||Object.keys(value.records).length>3000)fail();
 let total=0;
 for(const [key,record] of Object.entries(value.records)){
  if(!text(key,20000)||!plain(record)||Object.keys(record).some(field=>!['expression','ownerEntryId','ownerSnapshotSha256','entriesSha256','entries'].includes(field))||!text(record.expression,2000)||!text(record.ownerEntryId,2000)||!hash(record.ownerSnapshotSha256)||!hash(record.entriesSha256)||!Array.isArray(record.entries)||!record.entries.length||(total+=record.entries.length)>3000)fail();
  const ids=new Set<string>();for(const entry of record.entries){if(!entrySnapshot(entry)||ids.has(entry.id))fail();ids.add(entry.id);normalized(entry);checkEntry?.(entry);}
  if(sourceSpellChoiceContextDigest(record.entries)!==record.entriesSha256)fail();
 }
 if(JSON.stringify(value).length>20_000_000)fail();
}
export function sourceSpellChoiceContext(c:Character,key:string,owner:Selection,expression:string):{entries:Entry[];ready:boolean;unavailable?:boolean;reason?:string}{
 const value=c.sourceSpellChoiceContexts;if(value===undefined)return {entries:[],ready:false};
 try{validateSourceSpellChoiceContexts(value);}catch{return {entries:[],ready:false,unavailable:true,reason:'法表来源记录无法核对，相关自动施法暂停；原记录保留。'};}
 if(value.version!==1)return {entries:[],ready:false,unavailable:true,reason:'法表来源记录版本未知，相关自动施法暂停；原记录保留。'};
 const record=value.records?.[key];if(!record)return {entries:[],ready:false};
 if(record.expression!==expression||record.ownerEntryId!==owner.entry.id||record.ownerSnapshotSha256!==sourceSpellChoiceContextDigest(owner.entry))return {entries:[],ready:false,reason:'来源声明已变化，请重新选择以核对法表；原选择与消耗保留。'};
 return {entries:record.entries,ready:true};
}
/** Prepare the complete replacement before the explicit choice setter mutates character state. */
export function nextSourceSpellChoiceContext(c:Character,key:string,owner:Selection,draft:SourceSpellChoiceContextDraft):SourceSpellChoiceContexts{
 validateSourceSpellChoiceContexts(c.sourceSpellChoiceContexts);
 if(c.sourceSpellChoiceContexts&&c.sourceSpellChoiceContexts.version!==1)throw Error('法表来源记录版本未知，不能覆盖原记录。');
 const entries=structuredClone(draft.entries),record={expression:draft.expression,ownerEntryId:owner.entry.id,ownerSnapshotSha256:sourceSpellChoiceContextDigest(owner.entry),entriesSha256:sourceSpellChoiceContextDigest(entries),entries};
 const records={...c.sourceSpellChoiceContexts?.records};Object.defineProperty(records,key,{value:record,enumerable:true,writable:true,configurable:true});
 const next={version:1,records};validateSourceSpellChoiceContexts(next);return next;
}
