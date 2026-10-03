import type {Entry} from './model';

const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))?Number(value):undefined;

/** Read-only transport projection. Missing/malformed fields are not deletions;
 * explicit empty collections are. Never write these defaults back to a host. */
export function runtimeFrom(value:any,previous:any={}){
 const stats={...(record(previous.stats)?previous.stats:{})};
 if(record(value?.stats))for(const [key,raw] of Object.entries(value.stats)){const n=number(raw);if(n!==undefined)stats[key]=n;}
 const resources=resourceRows(value?.resources,previous.resources);
 const conditions=conditionRows(value?.conditions,previous.conditions);
 const revision=value?.documentRevision??previous.documentRevision;
 return {stats,resources,conditions,...(Number.isSafeInteger(revision)&&revision>=0?{documentRevision:revision}:{})};
}
function resourceRows(value:any,previous:any){
 if(!Array.isArray(value)&&!record(value))return Array.isArray(previous)?previous:[];
 const rows=Array.isArray(value)?value:Object.entries(value).map(([id,row])=>record(row)?{...row,id}:null);
 const valid=rows.filter((row:any)=>record(row)&&text(row.id));
 if(rows.length&&!valid.length)return Array.isArray(previous)?previous:[];
 return valid.map((row:any)=>{
  const old=Array.isArray(previous)?previous.find((r:any)=>r.id===row.id):undefined;
  return {...row,name:typeof row.name==='string'?row.name:old?.name||row.id,current:number(row.current)??old?.current??0,max:number(row.max)??old?.max??0};
 });
}
function conditionRows(value:any,previous:any){
 if(!Array.isArray(value))return Array.isArray(previous)?previous:[];
 const rows=value.flatMap(row=>{
  if(text(row))return [{id:row,name:row}];
  if(!record(row)||!text(row.id))return [];
  const condition:Record<string,any>={...row,id:row.id,name:text(row.name)?row.name:row.id};
  if(record(row.entry)&&text(row.entry.id)){
   const e=row.entry;
   condition.entry={...e,id:e.id,kind:'condition',name:text(e.name)?e.name:condition.name,english:typeof e.english==='string'?e.english:condition.name,source:text(e.source)?e.source:'IMPORTED',packId:text(e.packId)?e.packId:'imported',edition:['2014','2024','both'].includes(e.edition)?e.edition:'both',revision:typeof e.revision==='string'?e.revision:'1',entries:Array.isArray(e.entries)?e.entries:[],raw:record(e.raw)?e.raw:{}} as Entry;
  }else delete condition.entry;
  return [condition];
 });
 return value.length&&!rows.length&&Array.isArray(previous)?previous:rows;
}

/** Monster metadata has no durable character revision. Order its runtime and
 * document together across catalogs, partial receipts and background snapshots. */
export class MonsterRuntime {
 private rows=new Map<string,{sequence:number;value:any;document?:any}>();
 reset(){this.rows.clear();}
 restrict(grants:{itemId:string;key?:string}[]){for(const [id,row] of this.rows){const grant=grants.find(g=>g.itemId===id);if(!grant||grant.key&&row.value.key&&grant.key!==row.value.key)this.rows.delete(id);}}
 catalog(value:any,sequence=0){return this.accept(value,sequence).value;}
 snapshot(message:any){
  const row=this.accept(message.state,message.sequence||0,message.document);
  return {...message,state:row.value,...(row.document!==undefined?{document:row.document}:{})};
 }
 private accept(value:any,sequence:number,document?:any){
  const existing=this.rows.get(value.itemId),old=existing&&(!value.key||!existing.value.key||value.key===existing.value.key)?existing:undefined;
  const stale=!!old&&sequence<old.sequence;
  const next={...value,...(stale?runtimeFrom(old.value):runtimeFrom(value,old?.value)),...(value.targetId===undefined&&old?.value.targetId?{targetId:old.value.targetId}:{})};
  const row={sequence:Math.max(sequence,old?.sequence||0),value:next,document:stale?old.document??document:document===undefined?old?.document:document};
  // Catalogs do not erase the identity used to reject another monster incarnation.
  if(!next.key&&old?.value.key)next.key=old.value.key;
  this.rows.set(value.itemId,row);return row;
 }
}
