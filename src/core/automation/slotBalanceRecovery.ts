import {selectionAllowed,type Character,type Selection} from '../model';
import {classResourcePlan} from '../classResources';
import {parentClass} from '../featureOwnership';
import {automationEnabled} from './state';
import {ordinaryCastingRule,ordinaryCastingSnapshot} from './ordinaryCastingIdentity';
import {automaticSlotCounter,currentSlotCapacityReview,rememberKnownSlotBalance,type SlotCapacityReviewV1} from './slotCapacityReview';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
import {sourceTextSha256} from './sourceTextSha256';
import {preservableManualSlot,manualSlotDestinationFree,preserveManualSlot} from './manualSlotPreservation';
import {manualSlotDestination} from './slotCapacityReview';
import {validateCharacter} from '../validation';
import {ensureResourceWidget} from '../resourceWidgets';

export interface SlotBalanceRecoveryRequest {id:string;cardId:string;resourceId:string;remaining:number;basis:string;confirmExisting?:boolean;preserveManualAs?:string}
export interface SlotBalanceRecoveryOffer {resourceId:string;max:number;available:boolean;reason?:string;basis:string;requiresExistingConfirmation?:boolean;requiresManualPreservation?:boolean;existingRemaining?:number;existingFingerprint?:string;existingName?:string}
export type SlotBalanceRecoveryResult={status:'applied'|'duplicate';receipt:NonNullable<SlotCapacityReviewV1['lastConfirmation']>}|{status:'rejected';message:string};
function sourceReason(c:Character):string|undefined{
 const contexts=c.selections.filter(s=>s.entry.kind==='class'||s.entry.kind==='subclass'),classes=contexts.filter(s=>s.entry.kind==='class');
 const allowed=(s:Selection)=>{const proof=ordinaryCastingRule(s.entry);return !!proof&&s.entry.packId==='kiwee'&&selectionAllowed(c,s.entry)&&c.profile.enabledSources.includes(proof.source)&&!c.profile.disabledEntries?.includes(proof.id)&&(proof.edition==='both'||proof.edition===c.edition)&&(s.entry.dependencies||[]).every(id=>c.profile.enabledSources.includes(id));};
 if(!classes.length||contexts.some(s=>!allowed(s))||classes.some(s=>!Number.isSafeInteger(s.level)||s.level<1||s.level>20||classes.filter(other=>ordinaryCastingRule(other.entry)?.id===ordinaryCastingRule(s.entry)?.id).length!==1))return '职业来源或版本尚未核验，暂不能确认自动法术位。';
 for(const sub of contexts.filter(s=>s.entry.kind==='subclass')){
  const owner=parentClass(c,sub);if(!owner||!classes.some(s=>s.id===owner.id))return '子职与父职业的来源关联尚未核验。';
  if(sub.entry.raw.casterProgression){const rule=ordinaryCastingRule(sub.entry)!;if(rule.minLevel===null||owner.level<rule.minLevel||contexts.filter(s=>s.entry.kind==='subclass'&&s.entry.raw.casterProgression&&parentClass(c,s)?.id===owner.id).length!==1)return '子职施法的解锁等级或归属尚未核验。';}
 }
}
export function slotBalanceRecoveryBasis(c:Character,resourceId:string):string{
 return sourceTextSha256(JSON.stringify([c.id,c.revision,c.edition,c.profile,c.automation,c.runtime.slotCapacityReview,c.spellSettings,c.runtime.resources,c.quickbarLayout,c.selections.filter(s=>s.entry.kind==='class'||s.entry.kind==='subclass').map(s=>[s.id,s.entry.id,s.entry.source,s.entry.edition,s.entry.packId,s.entry.revision,ordinaryCastingSnapshot(s.entry),s.level,s.parentId]),resourceId]));
}
export function slotBalanceRecoveryOffer(c:Character,resourceId:string,authority?:SpellActionAuthority,confirmExisting=false,preserveManualAs?:string):SlotBalanceRecoveryOffer{
 const state=currentSlotCapacityReview(c),pending=state?.pending[resourceId],basis=slotBalanceRecoveryBasis(c,resourceId),max=pending?.max??0;
 const held=(reason:string):SlotBalanceRecoveryOffer=>({resourceId,max,basis,available:false,reason});
 const denied=spellActionAuthorityReason(c,authority);if(denied)return held(denied);
 if(!automationEnabled(c))return held('请先开启此角色卡的自动计算。');
 if(!/^spell-slot:[1-9]$/.test(resourceId)||!state||!pending)return held('当前没有可确认的缺失法术位余额。');
 const reason=sourceReason(c);if(reason)return held(reason);
 if(!c.spellSettings||!c.spellSettings.slots||typeof c.spellSettings.slots!=='object'||Array.isArray(c.spellSettings.slots))return held('卡面法术位记录尚未就绪，请重新读取。');
 const level=Number(resourceId.split(':')[1]);if(classResourcePlan(c).slots[level-1]!==max)return held('职业等级或法术位容量已变化，请重新核对。');
 // A saved marker never authorizes adoption of a manual/foreign or locked pool.
 // Recounting an existing automatic pool needs a separate explicit confirmation.
 const existing=c.runtime.resources[resourceId],mirror=c.spellSettings.slots[String(level)],count=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
 if(mirror&&(!count(mirror.max)||!count(mirror.used)||mirror.used>mirror.max))return held('原法术位记录无效，请先检查备份；原记录已保留。');
 const existingFingerprint=sourceTextSha256(JSON.stringify([existing,mirror]));
 if(existing&&!automaticSlotCounter(existing)){
  if(!preservableManualSlot(c,resourceId)||mirror&&(mirror.max!==existing.max||mirror.used!==existing.max-existing.current))return held('该位置的记录有锁定、来源归属或未知字段，请先在资源设置中核对；原记录已保留。');
  const extra={requiresExistingConfirmation:true,requiresManualPreservation:true,existingRemaining:existing.current,existingFingerprint,existingName:existing.name};
  return confirmExisting&&manualSlotDestinationFree(c,preserveManualAs)?{resourceId,max,basis,available:true,...extra}:{...held('保留原手工资源为独立记录后，才能建立自动法术位。'),...extra};
 }
 if(existing&&(existing.locked!==undefined&&existing.locked!==false||!count(existing.max)||!count(existing.current)||existing.current>existing.max))return held('该位置的自动记录已锁定或数值无效，原记录已保留。');
 if(existing||mirror){const extra={requiresExistingConfirmation:true,existingRemaining:existing?.current??mirror!.max-mirror!.used,existingFingerprint};return confirmExisting?{resourceId,max,basis,available:true,...extra}:{...held('已有自动法术位记录，请核对后明确确认更新余量。'),...extra};}
 return {resourceId,max,basis,available:true};
}
export function slotBalanceRecoveryRequest(c:Character,resourceId:string,remaining:number,id:string,confirmExisting=false,preserveManualAs?:string):SlotBalanceRecoveryRequest{
 return {id,cardId:c.id,resourceId,remaining,basis:slotBalanceRecoveryBasis(c,resourceId),...(confirmExisting?{confirmExisting:true}:{}),...(preserveManualAs?{preserveManualAs}:{})};
}
export const slotBalanceRecoveryFingerprint=(request:SlotBalanceRecoveryRequest)=>sourceTextSha256(JSON.stringify([request.cardId,request.resourceId,request.remaining,request.basis,request.confirmExisting===true,request.preserveManualAs]));
function requestData(value:unknown):SlotBalanceRecoveryRequest|undefined{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return;
  const descriptors=Object.getOwnPropertyDescriptors(value),fields=['id','cardId','resourceId','remaining','basis',...(Object.hasOwn(descriptors,'confirmExisting')?['confirmExisting']:[]),...(Object.hasOwn(descriptors,'preserveManualAs')?['preserveManualAs']:[])];
  if(Reflect.ownKeys(descriptors).length!==fields.length||!fields.every(key=>Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value')))return;
  return Object.fromEntries(fields.map(key=>[key,descriptors[key].value])) as SlotBalanceRecoveryRequest;
 }catch{return;}
}
export function performSlotBalanceRecovery(c:Character,request:SlotBalanceRecoveryRequest,authority?:SpellActionAuthority):SlotBalanceRecoveryResult{
 const reject=(message:string):SlotBalanceRecoveryResult=>({status:'rejected',message});
 const denied=spellActionAuthorityReason(c,authority);if(denied)return reject(denied);
 const payload=requestData(request);if(!payload)return reject('法术位余量确认格式无效。');request=payload;
 if(typeof request.id!=='string'||!request.id.trim()||request.id.length>128||typeof request.cardId!=='string'||request.cardId!==c.id||typeof request.resourceId!=='string'||!/^spell-slot:[1-9]$/.test(request.resourceId)||!Number.isSafeInteger(request.remaining)||request.remaining<0||typeof request.basis!=='string'||!/^[a-f0-9]{64}$/.test(request.basis)||request.confirmExisting!==undefined&&typeof request.confirmExisting!=='boolean')return reject('法术位余量确认格式无效。');
 if(!automationEnabled(c))return reject('请先开启此角色卡的自动计算。');
 if(request.preserveManualAs!==undefined&&!manualSlotDestination(request.preserveManualAs))return reject('手工资源保留位置无效，原记录已保留。');
 const state=currentSlotCapacityReview(c);if(!state)return reject('法术位余额记录版本尚不能处理，原记录已保留。');
 const fingerprint=slotBalanceRecoveryFingerprint(request);
 if(state.lastConfirmation?.id===request.id)return state.lastConfirmation.fingerprint===fingerprint?{status:'duplicate',receipt:state.lastConfirmation}:reject('操作编号已被用于其他确认，请重新填写。');
 const offer=slotBalanceRecoveryOffer(c,request.resourceId,authority,request.confirmExisting===true,request.preserveManualAs);
 if(!offer.available)return reject(offer.reason!);
 if(request.preserveManualAs!==undefined&&!offer.requiresManualPreservation)return reject('此法术位无需移动手工资源，未执行。');
 if(request.basis!==offer.basis||request.remaining>offer.max)return reject('卡面或余量已变化，请按当前状态重新确认。');
 const level=request.resourceId.split(':')[1],receipt={id:request.id,fingerprint,resourceId:request.resourceId,max:offer.max,remaining:request.remaining,...(request.preserveManualAs?{preservedManualAs:request.preserveManualAs}:{})};
 const next=structuredClone(state);delete next.pending[request.resourceId];next.lastConfirmation=receipt;
 // All validation precedes this single draft transaction. Zero is explicit.
 let draft:Character;
 try{
  draft=structuredClone(c);
  const replacement={name:`${level}环法术位`,type:'count',icon:'gem',...(request.preserveManualAs?{}:draft.runtime.resources[request.resourceId]),max:offer.max,current:request.remaining,automatic:true};
  if(request.preserveManualAs)preserveManualSlot(draft,request.resourceId,request.preserveManualAs,replacement);else {draft.runtime.resources[request.resourceId]=replacement;ensureResourceWidget(draft,request.resourceId,()=>0);}
  draft.spellSettings!.slots[level]={...draft.spellSettings!.slots[level],max:offer.max,used:offer.max-request.remaining};draft.runtime.slotCapacityReview=next;rememberKnownSlotBalance(draft,request.resourceId);
  validateCharacter(draft);
 }catch{return reject('手工资源无法完整保留，原卡和余量均未修改。');}
 c.runtime=draft.runtime;c.spellSettings=draft.spellSettings;c.quickbarLayout=draft.quickbarLayout;
 return {status:'applied',receipt};
}
