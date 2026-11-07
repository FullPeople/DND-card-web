import type {Character} from '../model';

export interface SlotCapacityReviewV1 {
 version:1;
 seen:string[];
 previous:Record<string,number>;
 pending:Record<string,{max:number}>;
}
export type SlotCapacityReviewState=SlotCapacityReviewV1|{version:number;[key:string]:unknown};
const slot=(id:string)=>/^spell-slot:[1-9]$/.test(id);
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function validateSlotCapacityReview(value:unknown):void{
 if(value===undefined)return;
 if(!plain(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('普通法术位余额核对记录无效。');
 // Future states remain opaque. Their ordinary pool domain stays held.
 if(value.version!==1)return;
 if(!exact(value,['version','seen','previous','pending'])||!Array.isArray(value.seen)||value.seen.length>9||!value.seen.every((id:unknown)=>typeof id==='string'&&slot(id))||new Set(value.seen).size!==value.seen.length||!plain(value.previous)||!plain(value.pending)||Object.keys(value.previous).length>9||Object.keys(value.pending).length>9)throw Error('普通法术位余额核对记录无效。');
 for(const [id,n] of Object.entries(value.previous))if(!slot(id)||!count(n))throw Error('普通法术位容量记录无效。');
 for(const [id,row] of Object.entries(value.pending))if(!slot(id)||!plain(row)||!exact(row,['max'])||!count(row.max)||row.max<1||!value.seen.includes(id))throw Error('待确认法术位余额记录无效。');
}
export function currentSlotCapacityReview(c:Character):SlotCapacityReviewV1|undefined{
 const state=c.runtime.slotCapacityReview;if(!state||state.version!==1)return;
 try{validateSlotCapacityReview(state);return state as SlotCapacityReviewV1;}catch{return;}
}
export function slotBalanceHeld(c:Character,id:string):boolean{
 if(!slot(id)||c.runtime.slotCapacityReview===undefined)return false;
 const state=currentSlotCapacityReview(c);return !state||Object.hasOwn(state.pending,id);
}
function knownMirror(c:Character,level:string){const s=c.spellSettings?.slots[level];return !!s&&count(s.max)&&count(s.used)&&s.used<=s.max;}
/** Detect missing legacy balances before ensure/cleanup. A numeric capacity is
 * never evidence that an already-existing character has all its uses left. */
export function syncSlotCapacityReview(c:Character,slots:readonly number[],beforeSlots?:readonly number[]):void{
 const stored=c.runtime.slotCapacityReview,state=currentSlotCapacityReview(c);
 if(stored!==undefined&&!state)return;
 const required=slots.flatMap((max,i)=>max>0?[{id:`spell-slot:${i+1}`,level:String(i+1),max}]:[]);
 const priorPools=Object.entries(c.runtime.resources).filter(([id,r])=>slot(id)&&r.automatic===true&&!r.featureGrant&&!r.sourceSpellGrant&&!r.limitedSourceUseGrant&&!r.itemChargeDebitGrant);
 if(!state&&!required.length&&!priorPools.length)return;
 const next:SlotCapacityReviewV1=state?structuredClone(state):{version:1,seen:[],previous:{},pending:{}};
 for(const row of required){
  const alreadySeen=next.seen.includes(row.id),missing=!Object.hasOwn(c.runtime.resources,row.id)&&!knownMirror(c,row.level);
  const previous=state?.previous[row.id]??beforeSlots?.[Number(row.level)-1];
  const actualNewUnlock=previous===0&&!alreadySeen;
  if(missing&&(alreadySeen||priorPools.length>0&&!actualNewUnlock))next.pending[row.id]={max:row.max};
  else if(Object.hasOwn(next.pending,row.id))next.pending[row.id].max=row.max;
  if(!alreadySeen)next.seen.push(row.id);
 }
 next.previous=Object.fromEntries(Array.from({length:9},(_,i)=>[`spell-slot:${i+1}`,slots[i]||0]));
 if(JSON.stringify(stored)!==JSON.stringify(next))c.runtime.slotCapacityReview=next;
}
