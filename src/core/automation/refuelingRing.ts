import type {Character,Entry} from '../model';
import {infusionRule,resolveInfusionBinding,validateInfusions,type InfusionResolution} from './infusions';
import {resolveRefuelingSlots,type RefuelingSlot} from './refuelingSlotResolver';
export type {RefuelingSlot} from './refuelingSlotResolver';

export type RefuelingRingAction={kind:'initialize';initial:0|1}|{kind:'use';slotKey:string;actionConfirmed:boolean}|{kind:'dawn';dawnConfirmed:boolean};
export interface RefuelingRingRecord {ownerId:string;ruleRef:string;targetId:string;current:0|1;max:1}
export interface RefuelingRingRequest {id:string;revision:number;sequence:number;basis:string;choiceId:string;entryId:string;key:string;action:RefuelingRingAction}
export interface RefuelingRingSlotReceipt {key:string;kind:'ordinary'|'pact';level:number;max:number;before:number;after:number;mirrorBefore?:number;mirrorAfter?:number}
export interface RefuelingRingReceipt {id:string;sequence:number;fingerprint:string;key:string;kind:RefuelingRingAction['kind'];action:RefuelingRingAction;before?:0|1;after:0|1;slot?:RefuelingRingSlotReceipt}
export interface RefuelingRingState {version:number;sequence:number;last?:RefuelingRingReceipt;records:Record<string,RefuelingRingRecord>}
export interface RefuelingRingOffer {supported:boolean;key?:string;current?:0|1;max:1;canInitialize:boolean;canUse:boolean;canDawn:boolean;reason?:string;useReason?:string;boundary:string;slots:RefuelingSlot[]}
export type RefuelingRingResult={status:'applied'|'duplicate';receipt:RefuelingRingReceipt;message:string}|{status:'rejected';message:string};
const RULE_REF='Spell-Refueling Ring|TCE';
const BASIS_LIMIT=1000000,FINGERPRINT_LIMIT=BASIS_LIMIT+20000;
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const balance=(value:unknown):value is 0|1=>value===0||value===1;
const keys=(value:object,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
export const refuelingRingKey=(ownerId:string,ruleRef:string,targetId:string)=>JSON.stringify([ownerId,ruleRef,targetId]);
function validAction(value:unknown):value is RefuelingRingAction{
 if(!object(value))return false;
 if(value.kind==='initialize')return keys(value,['kind','initial'])&&balance(value.initial);
 if(value.kind==='use')return keys(value,['kind','slotKey','actionConfirmed'])&&text(value.slotKey)&&value.actionConfirmed===true;
 return value.kind==='dawn'&&keys(value,['kind','dawnConfirmed'])&&value.dawnConfirmed===true;
}
function validSlotReceipt(value:unknown):value is RefuelingRingSlotReceipt{
 if(!object(value)||!keys(value,['key','kind','level','max','before','after','mirrorBefore','mirrorAfter'])||!['ordinary','pact'].includes(value.kind)||!Number.isSafeInteger(value.level)||value.level<1||value.level>3||value.key!==`${value.kind==='ordinary'?'spell':'pact'}-slot:${value.level}`||!Number.isSafeInteger(value.max)||value.max<1||!Number.isSafeInteger(value.before)||value.before<0||value.before>=value.max||value.after!==value.before+1)return false;
 return value.kind==='ordinary'?value.mirrorBefore===value.max-value.before&&value.mirrorAfter===value.max-value.after:value.mirrorBefore===undefined&&value.mirrorAfter===undefined;
}
/** A historical slot credit is not a continuing assertion about its present
 * balance: the player may subsequently cast a spell, rest or edit that pool. */
export function validateRefuelingRingState(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('法力恢复戒指记录版本无效，原记录保留。');
 if(value.version!==1)return;
 if(!keys(value,['version','sequence','last','records'])||!Number.isSafeInteger(value.sequence)||value.sequence<0||!object(value.records)||Object.keys(value.records).length>10000)throw Error('法力恢复戒指记录无效，原记录保留。');
 for(const [key,row] of Object.entries(value.records))if(!object(row)||!keys(row,['ownerId','ruleRef','targetId','current','max'])||!text(row.ownerId)||!text(row.targetId)||row.ruleRef!==RULE_REF||row.max!==1||!balance(row.current)||key!==refuelingRingKey(row.ownerId,row.ruleRef,row.targetId))throw Error('法力恢复戒指归属或次数无效，原记录保留。');
 if(value.sequence===0&&(value.last!==undefined||Object.keys(value.records).length)||value.sequence>0&&value.last===undefined)throw Error('法力恢复戒指序号与历史不一致。');
 const receipt=value.last;if(receipt===undefined)return;
 if(!object(receipt)||!keys(receipt,['id','sequence','fingerprint','key','kind','action','before','after','slot'])||!text(receipt.id,128)||receipt.sequence!==value.sequence-1||!Number.isSafeInteger(receipt.sequence)||!text(receipt.fingerprint,FINGERPRINT_LIMIT)||!text(receipt.key,6500)||!validAction(receipt.action)||receipt.kind!==receipt.action.kind||!balance(receipt.after)||!Object.hasOwn(value.records,receipt.key)||value.records[receipt.key].current!==receipt.after)throw Error('法力恢复戒指回执无效，原记录保留。');
 const action=receipt.action;
 const valid=action.kind==='initialize'?receipt.before===undefined&&receipt.after===action.initial&&receipt.slot===undefined:
  action.kind==='dawn'?receipt.before===0&&receipt.after===1&&receipt.slot===undefined:
  receipt.before===1&&receipt.after===0&&validSlotReceipt(receipt.slot)&&receipt.slot.key===action.slotKey;
 if(!valid)throw Error('法力恢复戒指历史转换无效，原记录保留。');
}
function storeReason(c:Character){
 try{validateRefuelingRingState(c.runtime.refuelingRing);}catch(error){return (error as Error).message;}
 if(c.runtime.refuelingRing&&c.runtime.refuelingRing.version!==1)return '此法力恢复戒指记录版本尚未支持，原记录保留且未修改。';
}
function resolve(c:Character,choiceId:string,entryId:string):InfusionResolution{
 try{validateInfusions(c.infusions);}catch{return {available:false,reason:'注法目标记录无效，原记录保留。'};}
 if(c.infusions?.version!==1)return {available:false,reason:'请先明确指定注法目标；未知版本记录不会被覆盖。'};
 const binding=c.infusions.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entryId);
 if(!binding)return {available:false,reason:'请先明确指定注法目标。'};
 return resolveInfusionBinding(c,binding);
}
/** No reading, evaluating, learning, binding or reopening initializes the use. */
export function refuelingRingOffer(c:Character,choiceId:string,entryId:string):RefuelingRingOffer{
 const entry=c.classChoiceSnapshots?.[entryId],rule=entry&&infusionRule(entry);
 const base:RefuelingRingOffer={supported:rule?.reference===RULE_REF,max:1,canInitialize:false,canUse:false,canDawn:false,boundary:rule?.reference===RULE_REF?rule.manualBoundary||'':'',slots:[]};
 if(!base.supported)return {...base,reason:'此注法没有已核对的法力恢复操作。'};
 const invalid=storeReason(c);if(invalid)return {...base,reason:invalid};
 const resolved=resolve(c,choiceId,entryId);if(!resolved.available)return {...base,reason:resolved.reason};
 const key=refuelingRingKey(resolved.owner.id,resolved.rule.reference,resolved.target.id),record=c.runtime.refuelingRing?.records[key];
 const eligible=resolveRefuelingSlots(c,resolved.owner.id),slots=eligible.slots;
 if(!record)return {...base,key,slots,canInitialize:true,reason:'尚未记录当前是否可用；请明确选择可用或已用，不会自动恢复。'};
 const unavailable=!resolved.target.equipped?'请先穿戴此戒指。':resolved.target.attuned!==true?'请先同调此戒指。':!record.current?'戒指当前已用，须在明确确认次日黎明后恢复。':!slots.length?eligible.reason||'没有已核对的已消耗 1–3 环法术位。':undefined;
 return {...base,key,slots,current:record.current,canUse:!unavailable,canDawn:record.current===0,...(unavailable?{useReason:unavailable}:{}),...(record.current===1?{reason:'戒指当前可用，无须恢复。'}:{})};
}
function entryBasis(entry:Entry){const {entries,...raw}=entry.raw;return {...entry,entries:undefined,choices:undefined,raw};}
function actionBasis(c:Character,choiceId:string,entryId:string){
 const ids=new Set([entryId,...(c.infusions?.version===1&&Array.isArray(c.infusions.bindings)?c.infusions.bindings.map(row=>row?.entryId):[])]);
 return JSON.stringify([c.id,c.edition,c.automation,c.profile,c.dismissedFeatures,c.selections.map(row=>({...row,entry:entryBasis(row.entry)})),c.answers,[...ids].map(id=>[id,c.classChoiceSnapshots?.[id]&&entryBasis(c.classChoiceSnapshots[id])]),c.infusions,c.runtime.refuelingRing?.version,c.runtime.refuelingRing?.sequence,c.runtime.refuelingRing?.records,c.runtime.resources,c.spellSettings,choiceId,entryId]);
}
export function refuelingRingActionRequest(c:Character,choiceId:string,entryId:string,id:string,action:RefuelingRingAction):RefuelingRingRequest{
 return {id,revision:c.revision,sequence:c.runtime.refuelingRing?.sequence??0,basis:actionBasis(c,choiceId,entryId),choiceId,entryId,key:refuelingRingOffer(c,choiceId,entryId).key||'',action:{...action}};
}
/** Validate everything before changing either side. The application persists
 * this complete draft and receipt together, without hydration/resource sync. */
export function performRefuelingRingAction(c:Character,request:RefuelingRingRequest):RefuelingRingResult{
 const reject=(message:string):RefuelingRingResult=>({status:'rejected',message});
 const invalid=storeReason(c);if(invalid)return reject(invalid);
 if(!object(request)||!keys(request,['id','revision','sequence','basis','choiceId','entryId','key','action'])||!text(request.id,128)||!Number.isSafeInteger(request.revision)||request.revision<0||!Number.isSafeInteger(request.sequence)||request.sequence<0||!text(request.basis,BASIS_LIMIT)||!text(request.choiceId)||!text(request.entryId)||!text(request.key,6500)||!validAction(request.action))return reject('法力恢复操作格式或明确确认无效，未执行。');
 const state=c.runtime.refuelingRing,fingerprint=JSON.stringify([request.revision,request.sequence,request.choiceId,request.entryId,request.key,request.basis,request.action]);
 if(fingerprint.length>FINGERPRINT_LIMIT)return reject('法力恢复操作记录超出支持范围，未执行。');
 if(state?.last?.id===request.id){if(state.last.sequence===request.sequence&&state.last.fingerprint===fingerprint)return {status:'duplicate',receipt:state.last,message:'该法力恢复操作已记录，未重复消耗或恢复。'};return reject('操作编号已被用于其他请求，请重新确认。');}
 const sequence=state?.sequence??0;
 if(request.sequence!==sequence||request.revision!==c.revision||request.basis!==actionBasis(c,request.choiceId,request.entryId))return reject('角色、来源、法术位或戒指次数已变化，请按当前记录重新确认。');
 if(sequence>=Number.MAX_SAFE_INTEGER)return reject('法力恢复操作序号已达上限，原记录保留。');
 const offer=refuelingRingOffer(c,request.choiceId,request.entryId),resolved=resolve(c,request.choiceId,request.entryId);
 if(!offer.supported||!resolved.available||offer.key!==request.key)return reject(offer.reason||'注法目标或来源已变化，未执行。');
 const action=request.action,before=offer.current;
 if(action.kind==='initialize'&&!offer.canInitialize||action.kind==='use'&&!offer.canUse||action.kind==='dawn'&&!offer.canDawn)return reject((action.kind==='use'?offer.useReason:offer.reason)||'此法力恢复操作当前不可用。');
 if(action.kind==='initialize'&&state&&Object.keys(state.records).length>=10000)return reject('法力恢复历史已达支持上限，原记录保留。');
 const slot=action.kind==='use'?offer.slots.find(row=>row.key===action.slotKey):undefined;
 if(action.kind==='use'&&!slot)return reject('所选法术位不再是可恢复的已消耗 1–3 环法术位，未执行。');
 const after:0|1=action.kind==='initialize'?action.initial:action.kind==='use'?0:1;
 const credit:RefuelingRingSlotReceipt|undefined=slot?{key:slot.key,kind:slot.kind,level:slot.level,max:slot.max,before:slot.current,after:slot.current+1,...(slot.kind==='ordinary'?{mirrorBefore:slot.mirrorUsed,mirrorAfter:slot.mirrorUsed!-1}:{})}:undefined;
 const record:RefuelingRingRecord={ownerId:resolved.owner.id,ruleRef:RULE_REF,targetId:resolved.target.id,current:after,max:1};
 const receipt:RefuelingRingReceipt={id:request.id,sequence,fingerprint,key:request.key,kind:action.kind,action:{...action},...(before===undefined?{}:{before}),after,...(credit?{slot:credit}:{})};
 const next:RefuelingRingState={version:1,sequence:sequence+1,last:receipt,records:{...state?.records,[request.key]:record}};
 try{validateRefuelingRingState(next);}catch(error){return reject((error as Error).message);}
 const runtime={...c.runtime,refuelingRing:next,...(slot?{resources:{...c.runtime.resources,[slot.key]:{...c.runtime.resources[slot.key],current:slot.current+1}}}:{})};
 const spellSettings=slot?.kind==='ordinary'?{...c.spellSettings!,slots:{...c.spellSettings!.slots,[String(slot.level)]:{...c.spellSettings!.slots[String(slot.level)],used:slot.mirrorUsed!-1}}}:c.spellSettings;
 c.runtime=runtime;if(slot?.kind==='ordinary')c.spellSettings=spellSettings;
 return {status:'applied',receipt,message:action.kind==='initialize'?`已记录戒指当前${after?'可用':'已用'}。`:action.kind==='dawn'?'已按确认的次日黎明恢复戒指使用资格，未改变法术位。':`已记录动作及戒指一次使用，恢复 1 个 ${slot!.level} 环${slot!.kind==='pact'?'契约位':'普通法术位'}。`};
}
