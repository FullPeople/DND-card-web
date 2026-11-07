import type {Character,RuntimeResource} from '../model';

export interface SlotBalanceProjection {spent:number;max:number;current:number}

export interface SlotCapacityReviewV1 {
 version:1;
 seen:string[];
 previous:Record<string,number>;
 pending:Record<string,{max:number}>;
 balances?:Record<string,SlotBalanceProjection>;
 lastConfirmation?:{id:string;fingerprint:string;resourceId:string;max:number;remaining:number};
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
 if(!exact(value,['version','seen','previous','pending',...(value.balances!==undefined?['balances']:[]),...(value.lastConfirmation!==undefined?['lastConfirmation']:[])])||!Array.isArray(value.seen)||value.seen.length>9||!value.seen.every((id:unknown)=>typeof id==='string'&&slot(id))||new Set(value.seen).size!==value.seen.length||!plain(value.previous)||!plain(value.pending)||Object.keys(value.previous).length>9||Object.keys(value.pending).length>9)throw Error('普通法术位余额核对记录无效。');
 for(const [id,n] of Object.entries(value.previous))if(!slot(id)||!count(n))throw Error('普通法术位容量记录无效。');
 for(const [id,row] of Object.entries(value.pending))if(!slot(id)||!plain(row)||!exact(row,['max'])||!count(row.max)||row.max<1||!value.seen.includes(id))throw Error('待确认法术位余额记录无效。');
 if(value.balances!==undefined){
  if(!plain(value.balances)||Object.keys(value.balances).length>9)throw Error('法术位消耗历史无效。');
  for(const [id,row] of Object.entries(value.balances))if(!slot(id)||!value.seen.includes(id)||!plain(row)||!exact(row,['spent','max','current'])||!count(row.spent)||!count(row.max)||!count(row.current)||row.current>row.max||row.current!==Math.max(0,row.max-row.spent))throw Error('法术位消耗历史无效。');
 }
 const last=value.lastConfirmation;
 if(last!==undefined&&(!plain(last)||!exact(last,['id','fingerprint','resourceId','max','remaining'])||typeof last.id!=='string'||!last.id.trim()||last.id.length>128||typeof last.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(last.fingerprint)||typeof last.resourceId!=='string'||!slot(last.resourceId)||!count(last.max)||last.max<1||!count(last.remaining)||last.remaining>last.max||!value.seen.includes(last.resourceId)))throw Error('法术位余量确认记录无效。');
}
export function currentSlotCapacityReview(c:Character):SlotCapacityReviewV1|undefined{
 const state=c.runtime.slotCapacityReview;if(!state||state.version!==1)return;
 try{validateSlotCapacityReview(state);return state as SlotCapacityReviewV1;}catch{return;}
}
export function slotBalanceHeld(c:Character,id:string):boolean{
 if(!slot(id)||c.runtime.slotCapacityReview===undefined)return false;
 const resource=c.runtime.resources[id];
 // Explicit manual and other-family counters retain their own ownership.
 if(resource&&!automaticSlotCounter(resource))return false;
 const state=currentSlotCapacityReview(c);if(!state||Object.hasOwn(state.pending,id))return true;
 const balance=state.balances?.[id];return !!balance&&!!resource&&!projectionMatches(c,id,balance);
}
function knownMirror(c:Character,level:string){const s=c.spellSettings?.slots[level];return !!s&&count(s.max)&&count(s.used)&&s.used<=s.max;}
export function automaticSlotCounter(r:RuntimeResource){return r.automatic===true&&!r.featureGrant&&!r.sourceSpellGrant&&!r.limitedSourceUseGrant&&!r.itemChargeDebitGrant&&!r.unlimited;}
function counter(r:RuntimeResource|undefined):r is RuntimeResource{return !!r&&automaticSlotCounter(r)&&count(r.max)&&count(r.current)&&r.current<=r.max;}
function projectionMatches(c:Character,id:string,row:SlotBalanceProjection){const r=c.runtime.resources[id],mirror=c.spellSettings?.slots[id.split(':')[1]];return counter(r)&&r.max===row.max&&r.current===row.current&&(!mirror||mirror.max===r.max&&mirror.used===r.max-r.current);}
/** A capacity projection preserves spent even while max temporarily falls
 * below it. This is distinct from an explicit change to the actual balance. */
export function projectKnownSlotBalance(c:Character,id:string,spent:number):void{
 const state=currentSlotCapacityReview(c),r=c.runtime.resources[id];if(!slot(id)||!state||state.pending[id]||!counter(r)||!count(spent)||r.current!==Math.max(0,r.max-spent)||!state.seen.includes(id))return;
 const row={spent,max:r.max,current:r.current};if(JSON.stringify(state.balances?.[id])!==JSON.stringify(row))c.runtime.slotCapacityReview={...state,balances:{...state.balances,[id]:row}};
}
/** Called by the actual generic setter/actor after an authorized value change. */
export function rememberKnownSlotBalance(c:Character,id:string):void{
 const state=currentSlotCapacityReview(c),r=c.runtime.resources[id];if(!slot(id)||!state||state.pending[id]||!counter(r)||!state.seen.includes(id))return;
 const old=state.balances?.[id];projectKnownSlotBalance(c,id,old&&old.max===r.max&&old.current===r.current?old.spent:r.max-r.current);
}
/** Current App draft edits can update either the counter or its used mirror.
 * A saved mismatch without that known before-state is held, never repaired. */
export function acceptExplicitSlotEdits(c:Character,before?:Character):void{
 if(!before||before.id!==c.id||JSON.stringify(c.runtime.slotCapacityReview)!==JSON.stringify(before.runtime.slotCapacityReview))return;
 const state=currentSlotCapacityReview(c),prior=currentSlotCapacityReview(before);if(!state||!prior)return;
 for(const [id,row] of Object.entries(prior.balances||{})){
  if(prior.pending[id]||!projectionMatches(before,id,row))continue;
  const r=c.runtime.resources[id],old=before.runtime.resources[id],level=id.split(':')[1],mirror=c.spellSettings?.slots[level],oldMirror=before.spellSettings?.slots[level];
  if(!counter(r)||r.locked!==undefined&&r.locked!==false||r.max!==old.max)continue;
  const changedCounter=r.current!==old.current,changedMirror=!!mirror&&!!oldMirror&&mirror.used!==oldMirror.used;
  if(!changedCounter&&!changedMirror)continue;
  if(changedMirror&&(!knownMirror(c,level)||mirror!.max!==r.max)||changedCounter&&changedMirror&&mirror!.used!==r.max-r.current)continue;
  if(changedMirror&&!changedCounter)r.current=r.max-mirror!.used;
  if(c.spellSettings)c.spellSettings.slots[level]={max:r.max,used:r.max-r.current};
  rememberKnownSlotBalance(c,id);
 }
}
/** Detect missing legacy balances before ensure/cleanup. A numeric capacity is
 * never evidence that an already-existing character has all its uses left. */
export function syncSlotCapacityReview(c:Character,slots:readonly number[],beforeSlots?:readonly number[]):void{
 const stored=c.runtime.slotCapacityReview,state=currentSlotCapacityReview(c);
 if(stored!==undefined&&!state)return;
 const required=slots.flatMap((max,i)=>max>0?[{id:`spell-slot:${i+1}`,level:String(i+1),max}]:[]);
 const priorPools=Object.entries(c.runtime.resources).filter(([id,r])=>slot(id)&&counter(r)&&r.locked!==true);
 if(!state&&!required.length&&!priorPools.length)return;
 const next:SlotCapacityReviewV1=state?structuredClone(state):{version:1,seen:[],previous:{},pending:{}};
 for(const [id,r] of priorPools){
  if(!counter(r)||next.pending[id]||!required.some(row=>row.id===id)&&!next.seen.includes(id))continue;
  const old=next.balances?.[id];if(old&&!projectionMatches(c,id,old)){const max=slots[Number(id.split(':')[1])-1]||old.max;if(max>0)next.pending[id]={max};continue;}
  if(!old){if(!next.seen.includes(id))next.seen.push(id);(next.balances||={})[id]={spent:r.max-r.current,max:r.max,current:r.current};}
 }
 for(const row of required){
  const alreadySeen=next.seen.includes(row.id),missing=!Object.hasOwn(c.runtime.resources,row.id)&&!knownMirror(c,row.level);
  const previous=state?.previous[row.id]??beforeSlots?.[Number(row.level)-1];
  const actualNewUnlock=previous===0&&!alreadySeen;
  if(missing&&!next.balances?.[row.id]&&(alreadySeen||priorPools.length>0&&!actualNewUnlock))next.pending[row.id]={max:row.max};
  else if(Object.hasOwn(next.pending,row.id))next.pending[row.id].max=row.max;
  if(!alreadySeen)next.seen.push(row.id);
 }
 next.previous=Object.fromEntries(Array.from({length:9},(_,i)=>[`spell-slot:${i+1}`,slots[i]||0]));
 if(JSON.stringify(stored)!==JSON.stringify(next))c.runtime.slotCapacityReview=next;
}
