import {selectionEffectsAllowed,type Character,type Issue,type Selection,type Entry} from '../model';
import {activeEffectSelections} from './active';
import {eligibleLegacySource} from './asi';
import {automationEnabled} from './state';
import {sourceObject as object,sourceEmpty} from './reviewedObservantSource';
import {reviewedAlertRule} from './reviewedAlertSource';
import evidence from './reviewedAlertEvidence.json' with {type:'json'};
export {reviewedAlertRule} from './reviewedAlertSource';
export type {ReviewedAlertRule} from './reviewedAlertSource';
export interface ReviewedAlertIntent {kind:'alert';confirmedManualInitiativeExcluded:true}
export interface ReviewedAlertBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedAlertIntent}
/** Independent optional domain; never part of ability-cap event ordering. */
export interface ReviewedAlertState {version:1;bindings:ReviewedAlertBinding[]}
const validIntent=(v:unknown):v is ReviewedAlertIntent=>object(v)&&v.kind==='alert'&&v.confirmedManualInitiativeExcluded===true&&Object.keys(v).every(key=>['kind','confirmedManualInitiativeExcluded'].includes(key));
export function validateReviewedAlert(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('警觉确认记录版本无效。');
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','bindings'].includes(key))||!Array.isArray(value.bindings)||value.bindings.length>100||Array.from(value.bindings).some(row=>!object(row)||Object.keys(row).some(key=>!['selectionId','choiceId','entryId','intent'].includes(key))||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)))throw Error('警觉确认记录无效：需明确确认先攻 +5 未计入手工数值。');
}
export function reviewedAlertStateValid(value:unknown):value is ReviewedAlertState{if(!object(value)||value.version!==1)return false;try{validateReviewedAlert(value);return true;}catch{return false;}}
export const reviewedAlertBindings=(c:Character):ReviewedAlertBinding[]=>reviewedAlertStateValid(c.reviewedAlert)?c.reviewedAlert.bindings:[];
function sourceFeat(c:Character,choiceId:string,entryId:string,active:Selection[]){
 const source=eligibleLegacySource(c,choiceId,active),entry=c.classChoiceSnapshots?.[entryId],rule=reviewedAlertRule(entry);
 if(!source||!entry||entry.id!==entryId||!rule||!selectionEffectsAllowed(c,entry)||!selectionEffectsAllowed(c,{...entry,id:evidence.feat.entryId})||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==entryId)return;
 const {owner,row,level}=source,slots=evidence.legacyClassSlots.filter(slot=>slot.owner===`${owner.entry.english}|${owner.entry.source}`&&slot.level===level);
 if(owner.entry.packId!=='kiwee'||row.entry.packId!=='kiwee'||slots.length!==1||!sourceEmpty(owner.entry.effects)||!sourceEmpty(owner.entry.choices)||!sourceEmpty(row.entry.effects)||!sourceEmpty(row.entry.choices)||owner.entry.raw._category!=='class'||row.entry.raw._classEdition!==undefined&&row.entry.raw._classEdition!=='2014'||row.entry.raw.effects!==undefined||row.entry.raw.choices!==undefined||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw.source!==owner.entry.source||!['classic',undefined].includes(owner.entry.raw.edition)||row.entry.raw.ENG_name!==row.entry.english||row.entry.raw.source!==row.entry.source||!['classic',undefined].includes(row.entry.raw.edition)||row.entry.raw.className!==owner.entry.raw.name||row.entry.raw.classSource!==owner.entry.source)return;
 if(!selectionEffectsAllowed(c,{...owner.entry,id:slots[0].ownerEntryId})||!selectionEffectsAllowed(c,{...row.entry,id:slots[0].featureEntryId}))return;
 return {...source,entry,rule};
}
const phbCandidate=(entry:Entry,entryId=evidence.feat.entryId)=>entry.id===evidence.feat.entryId||entry.id===entryId||(entry.kind==='feat'||entry.raw._category==='feat')&&(entry.english==='Alert'&&entry.source==='PHB'||entry.raw.ENG_name==='Alert'&&entry.raw.source==='PHB');
function eligibility(c:Character,choiceId:string,entryId:string,active=activeEffectSelections(c)){
 if(!automationEnabled(c))return {reason:'自动化当前未启用'};
 const grant=sourceFeat(c,choiceId,entryId,active);if(!grant)return {reason:'本次职业授予、所选警觉、等级或来源当前不可用，或授予归属不明确'};
 if(active.some(row=>phbCandidate(row.entry)))return {grant,reason:'同来源专长另有手工或导入条目，归属不明确；旧手工记录保留，未叠加新授予'};
 if(Object.entries(c.answers).filter(([id,ids])=>ids.length===1&&sourceFeat(c,id,ids[0],active)).length!==1)return {grant,reason:'PHB 警觉不可重复，存在多份职业选择记录，未叠加效果'};
 return {grant};
}
export interface ReviewedAlertComponentState {active:boolean;reason?:string;initiativeBonus:number}
export function evaluateReviewedAlert(c:Character,included?:Selection[]){
 const out={initiativeBonus:0,trace:[] as string[],issues:[] as Issue[],states:new Map<string,ReviewedAlertComponentState>()},store=c.reviewedAlert;
 if(store===undefined)return out;
 if(!object(store)){out.issues.push({id:'reviewed-alert-invalid',severity:'warning',message:'警觉确认记录结构无效，原记录保留且未生效。'});return out;}
 if(store.version!==1){out.issues.push({id:'reviewed-alert-version',severity:'warning',message:'警觉确认记录版本尚未支持，原记录保留且未生效。'});return out;}
 if(!reviewedAlertStateValid(store)){out.issues.push({id:'reviewed-alert-invalid',severity:'warning',message:'警觉确认记录结构无效，原记录保留且未生效。'});return out;}
 const source=activeEffectSelections(c),ids=included&&new Set(included.map(row=>row.id)),active=ids?source.filter(row=>ids.has(row.id)):source;
 for(const binding of store.bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';else if(store.bindings.filter(row=>row.choiceId===binding.choiceId||row.selectionId===binding.selectionId).length!==1)reason='本次警觉存在重复或无归属的确认记录';}
  out.states.set(`${binding.choiceId}|${binding.entryId}`,{active:!reason,reason,initiativeBonus:reason?0:5});
  if(reason){out.issues.push({id:`reviewed-alert:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`警觉暂不生效：${reason}；原确认记录保留。`});continue;}
  out.initiativeBonus+=5;out.trace.push(`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）：先攻 +5；突袭、未见攻击者、状态与掷骰顺序仍需手工裁定。`);
 }
 return out;
}
export interface ReviewedAlertStatus extends ReviewedAlertComponentState {eligible:boolean;binding?:ReviewedAlertBinding;selectionId?:string;rule?:ReturnType<typeof reviewedAlertRule>}
export function reviewedAlertStatus(c:Character,choiceId:string,entryId:string):ReviewedAlertStatus{
 const empty={eligible:false,active:false,initiativeBonus:0},store=c.reviewedAlert;
 if(store!==undefined&&!object(store))return {...empty,reason:'警觉确认记录结构无效，原记录保留。'};
 if(store!==undefined&&store.version!==1)return {...empty,reason:'警觉确认记录版本尚未支持，原记录保留。'};
 if(store!==undefined&&!reviewedAlertStateValid(store))return {...empty,reason:'警觉确认记录结构无效，原记录保留。'};
 const current=eligibility(c,choiceId,entryId),grant=current.grant,binding=reviewedAlertBindings(c).find(row=>row.choiceId===choiceId&&row.entryId===entryId),state=binding?evaluateReviewedAlert(c).states.get(`${choiceId}|${entryId}`):undefined;
 return {...empty,eligible:!!grant&&!current.reason,...state,binding,reason:state?.reason||current.reason,selectionId:grant?.row.id,rule:grant?.rule};
}
/** Atomic domain-only intent: no silent repair, migration or manual-total writes. */
export function setReviewedAlertIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedAlertIntent|null,catalog:Entry[]=[]):void{
 const store=c.reviewedAlert;if(store!==undefined){validateReviewedAlert(store);if(store.version!==1)throw Error('警觉确认记录版本尚未支持，原记录保留。');}
 const other=(store?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);if(intent===null){if(store)c.reviewedAlert={...store,bindings:other};return;}
 if(!validIntent(intent))throw Error('请明确确认先攻 +5 未计入手工数值。');
 const current=eligibility(c,choiceId,entryId);if(!current.grant||current.reason)throw Error(current.reason||'本次警觉授予当前不可用。');
 const claims=(store?.bindings||[]).filter(row=>row.choiceId===choiceId||row.selectionId===current.grant!.row.id);
 if(claims.length>1)throw Error('本次警觉存在重复授予确认，请先核对并明确撤回冲突记录，再重新确认；原记录保留。');
 if(claims.some(row=>row.choiceId!==choiceId||row.entryId!==entryId||row.selectionId!==current.grant!.row.id))throw Error('原警觉确认不属于当前职业授予实例，请先核对并明确撤回旧记录，再重新确认；原记录保留。');
 if(catalog.filter(entry=>phbCandidate(entry,entryId)).some(entry=>!reviewedAlertRule(entry)))throw Error('警觉资料身份、机械条款或声明冲突，待适配。');
 const state:ReviewedAlertState={version:1,bindings:[...other,{selectionId:current.grant.row.id,choiceId,entryId,intent:structuredClone(intent)}]},planned=evaluateReviewedAlert({...c,reviewedAlert:state}).states.get(`${choiceId}|${entryId}`);
 if(!planned?.active)throw Error(planned?.reason||'本次警觉当前不能生效。');
 c.reviewedAlert=state;
}
