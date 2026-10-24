import type {Character,Entry} from '../model';
import {activeSelections} from './active';
import {armorType} from './equipment';
import {infusionRule,resolveInfusionBinding,validateInfusions,type InfusionResolution} from './infusions';

export type InfusionChargeAction={kind:'initialize';initial:number}|{kind:'use';triggerConfirmed:boolean;reactionConfirmed:boolean}|{kind:'dawn';dawnConfirmed:boolean;roll:number};
export interface InfusionChargeRecord {ownerId:string;ruleRef:string;targetId:string;current:number;max:4}
export interface InfusionChargeRequest {id:string;revision:number;sequence:number;basis:string;choiceId:string;entryId:string;key:string;action:InfusionChargeAction}
export interface InfusionChargeReceipt {id:string;sequence:number;fingerprint:string;key:string;kind:InfusionChargeAction['kind'];action:InfusionChargeAction;before?:number;after:number}
export interface InfusionChargeState {version:number;sequence:number;last?:InfusionChargeReceipt;records:Record<string,InfusionChargeRecord>}
export interface InfusionChargeOffer {supported:boolean;key?:string;current?:number;max:4;canInitialize:boolean;canUse:boolean;canDawn:boolean;reason?:string;useReason?:string;boundary:string}
export type InfusionChargeResult={status:'applied'|'duplicate';receipt:InfusionChargeReceipt;message:string}|{status:'rejected';message:string};

const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const balance=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=4;
const allowedKeys=(value:object,keys:string[])=>Object.keys(value).every(key=>keys.includes(key));
const BASIS_LIMIT=1000000;
const FINGERPRINT_LIMIT=BASIS_LIMIT+20000;
const CHARGE_REFS=['Repulsion Shield|TCE','Mind Sharpener|TCE'];
/** Physical class and item selections own history, never catalog IDs or labels. */
export const infusionChargeKey=(ownerId:string,ruleRef:string,targetId:string)=>JSON.stringify([ownerId,ruleRef,targetId]);
function validAction(value:unknown):value is InfusionChargeAction{
 if(!object(value))return false;
 if(value.kind==='initialize')return allowedKeys(value,['kind','initial'])&&balance(value.initial);
 if(value.kind==='use')return allowedKeys(value,['kind','triggerConfirmed','reactionConfirmed'])&&value.triggerConfirmed===true&&value.reactionConfirmed===true;
 return value.kind==='dawn'&&allowedKeys(value,['kind','dawnConfirmed','roll'])&&value.dawnConfirmed===true&&Number.isSafeInteger(value.roll)&&value.roll>=1&&value.roll<=4;
}
/** Unknown versions survive imports untouched. Invalid v1 data rejects the import
 * and every charge action without repairing, clearing or taking ownership of it. */
export function validateInfusionChargeState(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('注法充能记录版本无效，原记录保留。');
 if(value.version!==1)return;
 if(!allowedKeys(value,['version','sequence','last','records'])||!Number.isSafeInteger(value.sequence)||value.sequence<0||!object(value.records)||Object.keys(value.records).length>10000)throw Error('注法充能记录无效，原记录保留。');
 for(const [key,row] of Object.entries(value.records)){
  if(!object(row)||!allowedKeys(row,['ownerId','ruleRef','targetId','current','max'])||!text(row.ownerId)||!text(row.targetId)||!CHARGE_REFS.includes(row.ruleRef)||row.max!==4||!balance(row.current)||key!==infusionChargeKey(row.ownerId,row.ruleRef,row.targetId))throw Error('注法充能归属或余额无效，原记录保留。');
 }
 const receipt=value.last;
 if(value.sequence===0&&(receipt!==undefined||Object.keys(value.records).length))throw Error('注法充能序号与历史不一致。');
 if(value.sequence>0&&receipt===undefined)throw Error('注法充能回执缺失，原记录保留。');
 if(receipt!==undefined){
  if(!object(receipt)||!allowedKeys(receipt,['id','sequence','fingerprint','key','kind','action','before','after'])||!text(receipt.id,128)||!Number.isSafeInteger(receipt.sequence)||receipt.sequence!==value.sequence-1||!text(receipt.fingerprint,FINGERPRINT_LIMIT)||!text(receipt.key,6500)||!validAction(receipt.action)||receipt.kind!==receipt.action.kind||!balance(receipt.after)||!Object.hasOwn(value.records,receipt.key)||value.records[receipt.key].current!==receipt.after)throw Error('注法充能回执无效，原记录保留。');
  const action=receipt.action;
  const validTransition=action.kind==='initialize'?receipt.before===undefined&&receipt.after===action.initial:
   action.kind==='use'?balance(receipt.before)&&receipt.before>=1&&receipt.after===receipt.before-1:
   balance(receipt.before)&&receipt.before<4&&receipt.after===Math.min(4,receipt.before+action.roll);
  if(!validTransition)throw Error('注法充能回执余额无效，原记录保留。');
 }
}
function storeReason(c:Character):string|undefined{
 try {validateInfusionChargeState(c.runtime.infusionCharges);}catch(error){return (error as Error).message;}
 if(c.runtime.infusionCharges&&c.runtime.infusionCharges.version!==1)return '此注法充能记录版本尚未支持，原记录保留且未修改。';
}
function resolve(c:Character,choiceId:string,entryId:string):InfusionResolution{
 try {validateInfusions(c.infusions);}catch{return {available:false,reason:'注法目标记录无效，原记录保留。'};}
 if(c.infusions?.version!==1)return {available:false,reason:'请先明确指定注法目标；未知版本记录不会被覆盖。'};
 const binding=c.infusions.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entryId);
 if(!binding)return {available:false,reason:'请先明确指定注法目标。'};
 return resolveInfusionBinding(c,binding);
}
function useReason(c:Character,resolved:Extract<InfusionResolution,{available:true}>):string|undefined{
 const {rule,target,binding}=resolved;
 if(!target.equipped)return '目标当前未穿戴或装备。';
 if(rule.requiresAttunement&&target.attuned!==true)return '请先同调此注法物品。';
 if(rule.requiresHeld&&binding.held!==true)return '请先明确确认当前持握此盾牌。';
 const type=armorType(target.entry);
 if(type&&activeSelections(c).filter(row=>row.equipped&&row.quantity>0&&armorType(row.entry)&&(armorType(row.entry)==='S')===(type==='S')).length!==1)return '同时穿戴的护甲或持用盾牌存在冲突，请先明确一件。';
}
/** Menu rendering and source synchronization never create or refill a balance. */
export function infusionChargeOffer(c:Character,choiceId:string,entryId:string):InfusionChargeOffer{
 const entry=c.classChoiceSnapshots?.[entryId],rule=entry&&infusionRule(entry);
 const base:InfusionChargeOffer={supported:!!rule?.charges,max:4,canInitialize:false,canUse:false,canDawn:false,boundary:rule?.charges?rule.manualBoundary||'':''};
 if(!base.supported)return {...base,reason:'此注法没有已核对的充能操作。'};
 const reason=storeReason(c);if(reason)return {...base,reason};
 const resolved=resolve(c,choiceId,entryId);if(!resolved.available)return {...base,reason:resolved.reason};
 const key=infusionChargeKey(resolved.owner.id,resolved.rule.reference,resolved.target.id),record=c.runtime.infusionCharges?.records[key];
 if(!record)return {...base,key,canInitialize:true,reason:'尚未记录当前充能；请明确输入 0–4，不会自动补满。'};
 const unavailable=useReason(c,resolved)||(!record.current?'充能不足。':undefined);
 return {...base,key,current:record.current,canUse:!unavailable,canDawn:record.current<4,...(unavailable?{useReason:unavailable}:{}),...(record.current===4?{reason:'充能已满，无须恢复。'}:{})};
}
// Retain every field consulted by source/parent/target authorization, but not
// long descriptive prose. The complete ownership/balance state is bound too.
function entryBasis(entry:Entry){const {entries,...raw}=entry.raw;return {...entry,entries:undefined,choices:undefined,raw};}
function actionBasis(c:Character,choiceId:string,entryId:string):string{
 const ids=new Set([entryId,...(c.infusions?.version===1&&Array.isArray(c.infusions.bindings)?c.infusions.bindings.map(row=>row?.entryId):[])]);
 const snapshots=[...ids].map(id=>[id,c.classChoiceSnapshots?.[id]&&entryBasis(c.classChoiceSnapshots[id])]);
 return JSON.stringify([c.id,c.edition,c.automation,c.profile,c.dismissedFeatures,c.selections.map(row=>({...row,entry:entryBasis(row.entry)})),c.answers,snapshots,c.infusions,c.runtime.infusionCharges?.version,c.runtime.infusionCharges?.sequence,c.runtime.infusionCharges?.records,choiceId,entryId]);
}
/** Capture this on opening the confirmation, not after a later card change. */
export function infusionChargeActionRequest(c:Character,choiceId:string,entryId:string,id:string,action:InfusionChargeAction):InfusionChargeRequest{
 return {id,revision:c.revision,sequence:c.runtime.infusionCharges?.sequence??0,basis:actionBasis(c,choiceId,entryId),choiceId,entryId,key:infusionChargeOffer(c,choiceId,entryId).key||'',action:{...action}};
}
/** One atomic character draft transaction. The application must persist the
 * whole draft and receipt together; this is not a server/multiplayer lock. */
export function performInfusionChargeAction(c:Character,request:InfusionChargeRequest):InfusionChargeResult{
 const reject=(message:string):InfusionChargeResult=>({status:'rejected',message});
 const invalidStore=storeReason(c);if(invalidStore)return reject(invalidStore);
 if(!object(request)||!allowedKeys(request,['id','revision','sequence','basis','choiceId','entryId','key','action'])||!text(request.id,128)||!Number.isSafeInteger(request.revision)||request.revision<0||!Number.isSafeInteger(request.sequence)||request.sequence<0||!text(request.basis,BASIS_LIMIT)||!text(request.choiceId)||!text(request.entryId)||!text(request.key,6500)||!validAction(request.action))return reject('注法充能操作格式或明确确认无效，未执行。');
 const state=c.runtime.infusionCharges,fingerprint=JSON.stringify([request.revision,request.sequence,request.choiceId,request.entryId,request.key,request.basis,request.action]);
 if(fingerprint.length>FINGERPRINT_LIMIT)return reject('注法充能操作记录超出支持范围，未执行。');
 if(state?.last?.id===request.id){
  if(state.last.sequence===request.sequence&&state.last.fingerprint===fingerprint)return {status:'duplicate',receipt:state.last,message:'该充能操作已记录，未重复扣除或恢复。'};
  return reject('操作编号已被用于其他请求，请重新确认。');
 }
 const sequence=state?.sequence??0;
 if(request.sequence!==sequence||request.revision!==c.revision||request.basis!==actionBasis(c,request.choiceId,request.entryId))return reject('角色、注法资格或余额已变化，请按当前记录重新确认。');
 if(sequence>=Number.MAX_SAFE_INTEGER)return reject('注法充能操作序号已达上限，原记录保留。');
 const offer=infusionChargeOffer(c,request.choiceId,request.entryId),resolved=resolve(c,request.choiceId,request.entryId);
 if(!offer.supported||!resolved.available||offer.key!==request.key)return reject(offer.reason||'注法目标或来源已变化，未执行。');
 const {action}=request,before=offer.current;
 if(action.kind==='initialize'&&!offer.canInitialize||action.kind==='use'&&!offer.canUse||action.kind==='dawn'&&!offer.canDawn)return reject((action.kind==='use'?offer.useReason:offer.reason)||'此充能操作当前不可用。');
 if(action.kind==='initialize'&&state&&Object.keys(state.records).length>=10000)return reject('注法充能历史已达支持上限，原记录保留。');
 const after=action.kind==='initialize'?action.initial:action.kind==='use'?before!-1:Math.min(4,before!+action.roll);
 if(!balance(after))return reject('注法充能余额无效，未执行。');
 const record:InfusionChargeRecord={ownerId:resolved.owner.id,ruleRef:resolved.rule.reference,targetId:resolved.target.id,current:after,max:4};
 const receipt:InfusionChargeReceipt={id:request.id,sequence,fingerprint,key:request.key,kind:action.kind,action:{...action},...(before===undefined?{}:{before}),after};
 const next:InfusionChargeState={version:1,sequence:sequence+1,last:receipt,records:{...state?.records,[request.key]:record}};
 try {validateInfusionChargeState(next);}catch(error){return reject((error as Error).message);}
 // No mutation occurs before this assignment, including receipt validation.
 c.runtime.infusionCharges=next;
 return {status:'applied',receipt,message:action.kind==='initialize'?`已记录当前充能 ${after} / 4。`:action.kind==='use'?`已记录反应消耗 1 充能，剩余 ${after} / 4；实际效果仍需手动处理。`:`已按确认的黎明 1d4 结果 ${action.roll} 恢复 ${after-before!} 充能，当前 ${after} / 4。`};
}
