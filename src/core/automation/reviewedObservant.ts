import {ABILITIES,selectionEffectsAllowed,type Ability,type Character,type Issue,type Selection,type Entry} from '../model';
import {activeEffectSelections} from './active';
import {eligibleLegacySource,legacySourceIdentity} from './asi';
import {automationEnabled} from './state';
import {baseAbilityScores} from './baseAbilities';
import {evaluateAbilityAdvancements} from './abilityAdvancements';
import {reviewedObservantRule,sourceObject as object,sourceEmpty} from './reviewedObservantSource';
export {reviewedObservantRule} from './reviewedObservantSource';
export type {ReviewedObservantRule} from './reviewedObservantSource';
import evidence from './reviewedObservantEvidence.json' with {type:'json'};
export interface ReviewedObservantIntent {kind:'observant';ability:'int'|'wis';confirmedManualAbilityExcluded:true;confirmedManualPassivesExcluded:true}
export interface ReviewedObservantBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedObservantIntent}
export interface ReviewedObservantState {version:1;bindings:ReviewedObservantBinding[]}
const validIntent=(v:unknown):v is ReviewedObservantIntent=>object(v)&&v.kind==='observant'&&typeof v.ability==='string'&&(v.ability==='int'||v.ability==='wis')&&v.confirmedManualAbilityExcluded===true&&v.confirmedManualPassivesExcluded===true&&Object.keys(v).every(key=>['kind','ability','confirmedManualAbilityExcluded','confirmedManualPassivesExcluded'].includes(key));
export function validateReviewedObservant(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('观察力确认记录版本无效。');
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','bindings'].includes(key))||!Array.isArray(value.bindings)||value.bindings.length>100||Array.from(value.bindings).some(row=>!object(row)||Object.keys(row).some(key=>!['selectionId','choiceId','entryId','intent'].includes(key))||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)))throw Error('观察力确认记录无效：请选择智力或感知，并分别确认属性与两项被动加值未计入手工数值。');
}
export function reviewedObservantStateValid(value:unknown):value is ReviewedObservantState{if(!object(value)||value.version!==1)return false;try{validateReviewedObservant(value);return true;}catch{return false;}}
export const reviewedObservantBindings=(c:Character):ReviewedObservantBinding[]=>reviewedObservantStateValid(c.reviewedObservant)?c.reviewedObservant.bindings:[];
function sourceShape(owner:Selection,row:Selection,level:number){
 const slots=evidence.legacyClassSlots.filter(slot=>slot.owner===`${owner.entry.english}|${owner.entry.source}`&&slot.level===level);
 if(owner.entry.packId!=='kiwee'||row.entry.packId!=='kiwee'||slots.length!==1||!sourceEmpty(owner.entry.effects)||!sourceEmpty(owner.entry.choices)||owner.entry.raw._category!=='class'||row.entry.raw._classEdition!==undefined&&row.entry.raw._classEdition!=='2014'||row.entry.raw.effects!==undefined||row.entry.raw.choices!==undefined||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw.source!==owner.entry.source||!['classic',undefined].includes(owner.entry.raw.edition)||row.entry.raw.ENG_name!==row.entry.english||row.entry.raw.source!==row.entry.source||!['classic',undefined].includes(row.entry.raw.edition)||row.entry.raw.className!==owner.entry.raw.name||row.entry.raw.classSource!==owner.entry.source)return;
 return slots[0];
}
function sourceFeat(c:Character,choiceId:string,entryId:string,active:Selection[]){
 const source=eligibleLegacySource(c,choiceId,active),entry=c.classChoiceSnapshots?.[entryId],rule=reviewedObservantRule(entry);
 if(!source||!entry||entry.id!==entryId||!rule||!selectionEffectsAllowed(c,entry)||!selectionEffectsAllowed(c,{...entry,id:evidence.feat.entryId})||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==entryId)return;
 const slot=sourceShape(source.owner,source.row,source.level);if(!slot||!selectionEffectsAllowed(c,{...source.owner.entry,id:slot.ownerEntryId})||!selectionEffectsAllowed(c,{...source.row.entry,id:slot.featureEntryId}))return;
 return {...source,entry,rule};
}
function eligibility(c:Character,choiceId:string,entryId:string,active=activeEffectSelections(c)){
 if(!automationEnabled(c))return {reason:'自动化当前未启用'};
 const grant=sourceFeat(c,choiceId,entryId,active);if(!grant)return {reason:'本次职业授予、所选观察力、等级或来源当前不可用，或授予归属不明确'};
 if(active.some(row=>row.entry.id===evidence.feat.entryId||row.entry.english==='Observant'&&row.entry.source==='PHB'||row.entry.raw.ENG_name==='Observant'&&row.entry.raw.source==='PHB'))return {grant,reason:'同来源专长另有手工或导入条目，归属不明确；旧手工记录保留，未叠加新授予'};
 if(Object.entries(c.answers).filter(([id,ids])=>ids.length===1&&sourceFeat(c,id,ids[0],active)).length!==1)return {grant,reason:'PHB 观察力不可重复，存在多份职业选择记录，未叠加效果'};
 return {grant};
}
export const reviewedObservantGrantLevel=(c:Character,choiceId:string,entryId:string,active?:Selection[])=>sourceFeat(c,choiceId,entryId,active||activeEffectSelections(c))?.level;
/** Retained means authenticated source ownership, even if source/level/automation
 * is temporarily stopped. Forged/future/corrupt data never exposes a new score. */
export function reviewedObservantHasRetainedBinding(c:Character):boolean{
 const bindings=reviewedObservantBindings(c),archives=Object.values(c.classChoiceArchive||{}),rows=[...c.selections,...archives.flatMap(a=>a.selections)],active=activeEffectSelections(c);
 const completeAncestry=(start:Selection,pool:Selection[])=>{let current:Selection|undefined=start;const seen=new Set<string>();while(current){if(seen.has(current.id)||pool.filter(row=>row.id===current!.id).length!==1)return false;seen.add(current.id);if(!current.parentId)return true;const parentId:string=current.parentId;current=pool.find(row=>row.id===parentId);if(!current)return false;}return false;};
 return bindings.some(binding=>{
  const entry=c.classChoiceSnapshots?.[binding.entryId];
  if(!entry||entry.id!==binding.entryId||bindings.filter(row=>row.choiceId===binding.choiceId||row.selectionId===binding.selectionId).length!==1||!reviewedObservantRule(entry)||c.answers[binding.choiceId]?.length!==1||c.answers[binding.choiceId][0]!==binding.entryId)return false;
  // An actually active authenticated grant always exposes both passive scores.
  const current=eligibility(c,binding.choiceId,binding.entryId,active);if(current.grant&&!current.reason&&current.grant.row.id===binding.selectionId)return true;
  const roots=rows.filter(row=>row.id===binding.selectionId);if(roots.length!==1)return false;const row=roots[0],owners=c.selections.filter(s=>s.id===row.parentId);if(owners.length!==1)return false;const owner=owners[0];
  if(c.selections.filter(s=>s.entry.kind==='class'&&s.entry.english===owner.entry.english&&s.entry.source===owner.entry.source&&s.entry.edition===owner.entry.edition).length!==1||!completeAncestry(owner,c.selections)||!completeAncestry(row,rows))return false;
  if(rows.filter(s=>s.parentId===owner.id&&(s.grantKey===row.grantKey||s.entry.kind==='feature'&&s.entry.english===row.entry.english&&s.entry.source===row.entry.source&&s.entry.raw.level===row.entry.raw.level)).length!==1)return false;
  return legacySourceIdentity(owner,row,binding.choiceId)&&!!sourceShape(owner,row,row.entry.raw.level);
 });
}
export interface ReviewedObservantComponentState {active:boolean;reason?:string;abilityBonus:number;abilityActive:boolean;passivesActive:boolean;passivePerceptionBonus:number;passiveInvestigationBonus:number;abilityBefore?:number}
export function evaluateReviewedObservant(c:Character,base:Record<Ability,number>,included?:Selection[],only?:ReviewedObservantBinding){
 const bonuses=Object.fromEntries(ABILITIES.map(a=>[a,0])) as Record<Ability,number>,trace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const out={bonuses,trace,issues:[] as Issue[],states:new Map<string,ReviewedObservantComponentState>(),passivePerceptionBonus:0,passiveInvestigationBonus:0,passivePerceptionTrace:[] as string[],passiveInvestigationTrace:[] as string[]};
 const store=c.reviewedObservant;if(store===undefined)return out;
 if(!object(store)){out.issues.push({id:'reviewed-observant-invalid',severity:'warning',message:'观察力确认记录结构无效，原记录保留且未生效。'});return out;}
 if(store.version!==1){out.issues.push({id:'reviewed-observant-version',severity:'warning',message:'观察力确认记录版本尚未支持，原记录保留且未生效。'});return out;}
 if(!reviewedObservantStateValid(store)){out.issues.push({id:'reviewed-observant-invalid',severity:'warning',message:'观察力确认记录结构无效，原记录保留且未生效。'});return out;}
 const source=activeEffectSelections(c),safe=new Set(source.map(row=>row.id)),active=(included||source).filter(row=>safe.has(row.id));
 for(const binding of only?[only]:store.bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';else if(!store.bindings.includes(binding)||store.bindings.filter(row=>row.choiceId===binding.choiceId||row.selectionId===binding.selectionId).length!==1)reason='本次观察力存在重复或无归属的确认记录';else if(!Number.isSafeInteger(base[binding.intent.ability]))reason='此前所选属性值无效，未计算观察力加值';}
  const activeNow=!reason,abilityBonus=activeNow&&base[binding.intent.ability]<20?1:0;
  out.states.set(`${binding.choiceId}|${binding.entryId}`,{active:activeNow,reason,abilityBonus,abilityActive:activeNow,passivesActive:activeNow,passivePerceptionBonus:activeNow?5:0,passiveInvestigationBonus:activeNow?5:0,abilityBefore:base[binding.intent.ability]});
  if(reason){out.issues.push({id:`reviewed-observant:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`观察力暂不生效：${reason}；原确认记录保留。`});continue;}
  const origin=`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）`;
  out.bonuses[binding.intent.ability]+=abilityBonus;out.trace[binding.intent.ability].push(`${origin}：显式选择 ${binding.intent.ability.toUpperCase()} +${abilityBonus}（上限 20，不降低已有属性）；属性封顶不取消两项被动 +5。`);
  out.passivePerceptionBonus+=5;out.passiveInvestigationBonus+=5;out.passivePerceptionTrace.push(`${origin}：被动察觉 +5；不改变主动察觉检定。`);out.passiveInvestigationTrace.push(`${origin}：被动调查 +5；不改变主动调查检定。`);
 }
 return out;
}
export interface ReviewedObservantStatus extends ReviewedObservantComponentState {eligible:boolean;binding?:ReviewedObservantBinding;selectionId?:string;rule?:ReturnType<typeof reviewedObservantRule>}
export function reviewedObservantStatus(c:Character,choiceId:string,entryId:string,previewAbility?:'int'|'wis'):ReviewedObservantStatus{
 const empty={eligible:false,active:false,abilityBonus:0,abilityActive:false,passivesActive:false,passivePerceptionBonus:0,passiveInvestigationBonus:0},store=c.reviewedObservant;
 if(store!==undefined&&!object(store))return {...empty,reason:'观察力确认记录结构无效，原记录保留。'};
 if(store!==undefined&&store.version!==1)return {...empty,reason:'观察力确认记录版本尚未支持，原记录保留。'};
 if(store!==undefined&&!reviewedObservantStateValid(store))return {...empty,reason:'观察力确认记录结构无效，原记录保留。'};
 const current=eligibility(c,choiceId,entryId),grant=current.grant,binding=reviewedObservantBindings(c).find(row=>row.choiceId===choiceId&&row.entryId===entryId),active=activeEffectSelections(c),base=baseAbilityScores(c,active).abilities,state=binding?evaluateAbilityAdvancements(c,base,active).observant.states.get(`${choiceId}|${entryId}`):undefined;
 const ability=binding?.intent.ability||previewAbility,prior=grant&&ability?evaluateAbilityAdvancements(c,base,active,{level:grant.level,choiceId,entryId,selectionId:grant.row.id}):undefined,abilityBefore=ability?(prior?base[ability]+prior.asi.bonuses[ability]+prior.reviewed.bonuses[ability]+prior.linguist.bonuses[ability]+prior.observant.bonuses[ability]:base[ability]):undefined;
 return {...empty,eligible:!!grant&&!current.reason,abilityBefore,abilityBonus:!current.reason&&abilityBefore!==undefined&&Number.isSafeInteger(abilityBefore)&&abilityBefore<20?1:0,...state,binding,reason:state?.reason||current.reason,selectionId:grant?.row.id,rule:grant?.rule};
}
/** Atomic domain-only intent; no repair, migration or writes to manual totals. */
export function setReviewedObservantIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedObservantIntent|null,catalog:Entry[]=[]):void{
 const store=c.reviewedObservant;if(store!==undefined){validateReviewedObservant(store);if(store.version!==1)throw Error('观察力确认记录版本尚未支持，原记录保留。');}
 const other=(store?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);if(intent===null){if(store)c.reviewedObservant={...store,bindings:other};return;}
 if(!validIntent(intent))throw Error('请选择智力或感知，并分别确认属性与两项被动加值未计入手工数值。');
 const current=eligibility(c,choiceId,entryId);if(!current.grant||current.reason)throw Error(current.reason||'本次观察力授予当前不可用。');
 const claims=(store?.bindings||[]).filter(row=>row.choiceId===choiceId||row.selectionId===current.grant!.row.id);
 if(claims.length>1)throw Error('本次观察力存在重复授予确认，请先核对并明确撤回冲突记录，再重新确认；原记录保留。');
 if(claims.some(row=>row.choiceId===choiceId&&row.entryId===entryId&&row.selectionId!==current.grant!.row.id))throw Error('原观察力确认不属于当前职业授予实例，请先核对并明确撤回旧记录，再重新确认；原记录保留。');
 const matches=catalog.filter(entry=>entry.id===evidence.feat.entryId||entry.id===entryId||(entry.kind==='feat'||entry.raw._category==='feat')&&(entry.english==='Observant'&&entry.source==='PHB'||entry.raw.ENG_name==='Observant'&&entry.raw.source==='PHB'));
 if(matches.some(entry=>!reviewedObservantRule(entry)))throw Error('观察力资料身份、机械条款或声明冲突，待适配。');
 const binding:ReviewedObservantBinding={selectionId:current.grant.row.id,choiceId,entryId,intent:structuredClone(intent)},state:ReviewedObservantState={version:1,bindings:[...other,binding]},base=baseAbilityScores(c,activeEffectSelections(c)).abilities,planned=evaluateAbilityAdvancements({...c,reviewedObservant:state},base),status=planned.observant.states.get(`${choiceId}|${entryId}`);
 if(!status?.active)throw Error(status?.reason||'本次观察力当前不能生效。');
 const before=evaluateAbilityAdvancements(c,base);for(const [key,value] of before.asi.states)if(value.active&&!planned.asi.states.get(key)?.active)throw Error('本次观察力选择会令已有属性提升超过上限，请先调整原分配。');for(const [key,value] of before.reviewed.states)if(value.active&&!planned.reviewed.states.get(key)?.active)throw Error('本次观察力选择会令已确认专长失效，请先调整原选择。');
 c.reviewedObservant=state;
}
