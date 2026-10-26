import {ABILITIES,selectionEffectsAllowed,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {eligibleLegacySource} from './asi';
import {automationEnabled} from './state';
import {baseAbilityScores} from './baseAbilities';
import {evaluateAbilityAdvancements} from './abilityAdvancements';
import evidence from './reviewedLinguistEvidence.json' with {type:'json'};

export interface ReviewedLinguistIntent {kind:'linguist';languages:string[];confirmedManualAbilityExcluded:true;dmAllowedLanguages:string[]}
export interface ReviewedLinguistBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedLinguistIntent}
/** Independent versioned ownership. Unknown future data is retained, not edited. */
export interface ReviewedLinguistState {version:1;bindings:ReviewedLinguistBinding[]}
export interface ReviewedLinguistRule {kind:'linguist';reference:'Linguist|PHB';page:167}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;
 if(!object(a)&&!Array.isArray(a)||!object(b)&&!Array.isArray(b)||Array.isArray(a)!==Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&same(left[key],right[key]));
};
const absentOrEmpty=(v:unknown)=>v===undefined||Array.isArray(v)&&v.length===0;
const metadata=new Set(['name','ENG_name','source','page','edition','entries','additionalEntries','srd','basicRules','referenceSources','reprintedAs','hasFluff','hasFluffImages','translator','otherSources','additionalSources','_category']);
const mechanics=(raw:Entry['raw'])=>Object.fromEntries(Object.entries(raw).filter(([key])=>!metadata.has(key)));
export function reviewedLinguistRule(entry:Entry|undefined):ReviewedLinguistRule|undefined{
 if(!entry)return;
 const raw=entry.raw;
 if(entry.kind!=='feat'||entry.english!=='Linguist'||entry.source!=='PHB'||entry.edition!=='2014'||entry.packId!=='kiwee'||raw.ENG_name!=='Linguist'||raw.source!=='PHB'||raw._category!=='feat'||entry.page!==167||raw.page!==167||!absentOrEmpty(entry.effects)||!absentOrEmpty(entry.choices)||!absentOrEmpty(entry.dependencies))return;
 if(Object.keys(raw).some(key=>key!=='_category'&&!evidence.feat.rawKeys.includes(key))||!same(mechanics(raw),evidence.feat.mechanics))return;
 if(!Array.isArray(raw.entries)||raw.entries.length!==2||typeof raw.entries[0]!=='string'||!raw.entries[0].trim()||!object(raw.entries[1])||Object.keys(raw.entries[1]).some(key=>!['type','items'].includes(key))||raw.entries[1].type!=='list'||!Array.isArray(raw.entries[1].items)||raw.entries[1].items.length!==2||raw.entries[1].items.some((item:unknown)=>typeof item!=='string'||!item.trim())||!entry.entries.length)return;
 if(raw.reprintedAs!==undefined&&(!Array.isArray(raw.reprintedAs)||raw.reprintedAs.length!==1||typeof raw.reprintedAs[0]!=='string'||!raw.reprintedAs[0].endsWith('|XPHB')))return;
 return {kind:'linguist',reference:'Linguist|PHB',page:167};
}
const proof=(ref:string)=>evidence.languages.find(row=>row.reference===ref);
const restricted=(ref:string)=>proof(ref)?.type!=='standard';
export function reviewedLinguistReferencesValid(value:unknown):value is string[]{return Array.isArray(value)&&value.length===3&&Array.from(value).every(v=>typeof v==='string'&&!!proof(v))&&new Set(value).size===3;}
function validIntent(value:unknown):value is ReviewedLinguistIntent{
 if(!object(value)||value.kind!=='linguist'||value.confirmedManualAbilityExcluded!==true||!reviewedLinguistReferencesValid(value.languages)||!Array.isArray(value.dmAllowedLanguages)||Object.keys(value).some(key=>!['kind','languages','confirmedManualAbilityExcluded','dmAllowedLanguages'].includes(key)))return false;
 const allowed=value.languages.filter(restricted);
 return value.dmAllowedLanguages.length===allowed.length&&new Set(value.dmAllowedLanguages).size===allowed.length&&Array.from(value.dmAllowedLanguages).every(ref=>typeof ref==='string'&&allowed.includes(ref));
}
export function validateReviewedLinguist(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('语言学家确认记录版本无效。');
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','bindings'].includes(key))||!Array.isArray(value.bindings)||value.bindings.length>100||Array.from(value.bindings).some(row=>!object(row)||Object.keys(row).some(key=>!['selectionId','choiceId','entryId','intent'].includes(key))||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)))throw Error('语言学家确认记录无效：需三种不同的 PHB 语言、未计入手工智力的确认及本次受限语言的准确 DM 许可。');
}
export function reviewedLinguistStateValid(value:unknown):value is ReviewedLinguistState{if(!object(value)||value.version!==1)return false;try{validateReviewedLinguist(value);return true;}catch{return false;}}
export const reviewedLinguistBindings=(c:Character):ReviewedLinguistBinding[]=>reviewedLinguistStateValid(c.reviewedLinguist)?c.reviewedLinguist.bindings:[];
function sourceEntry(reference:string):Entry{
 const row=proof(reference)!;
 return {id:row.entryId,kind:'rule',name:row.name,english:row.english,source:'PHB',edition:'2014',packId:'kiwee',revision:row.entryHash,page:row.page,entries:[],raw:{name:row.name,ENG_name:row.english,source:'PHB',page:row.page,...('rawEdition' in row?{edition:row.rawEdition}:{}),...row.mechanics,_category:row.category}};
}
export function reviewedLinguistReference(entry:Entry):string|undefined{
 const row=evidence.languages.find(row=>row.entryId===entry.id);if(!row)return;
 const raw=entry.raw;
 if(entry.kind!=='rule'||entry.packId!=='kiwee'||entry.english!==row.english||raw.ENG_name!==row.english||entry.source!=='PHB'||raw.source!=='PHB'||entry.edition!=='2014'||entry.page!==row.page||raw.page!==row.page||raw._category!==row.category||raw.edition!==('rawEdition' in row?row.rawEdition:undefined)||!absentOrEmpty(entry.effects)||!absentOrEmpty(entry.choices)||!absentOrEmpty(entry.dependencies))return;
 if(Object.keys(raw).some(key=>!['_category','entries','additionalEntries'].includes(key)&&!row.rawKeys.includes(key))||!same(mechanics(raw),row.mechanics))return;
 return row.reference;
}
export interface ReviewedLinguistOption {value:string;label:string;entry:Entry;restricted:boolean;unavailable?:string}
export function reviewedLinguistOptions(c:Character,catalog:Entry[]=[]):ReviewedLinguistOption[]{
 return evidence.languages.map(row=>{
  const fallback=sourceEntry(row.reference),matches=catalog.filter(entry=>entry.id===row.entryId||entry.raw._category==='language'&&(entry.english===row.english&&entry.source==='PHB'||entry.raw.ENG_name===row.english&&entry.raw.source==='PHB')),conflict=matches.some(entry=>reviewedLinguistReference(entry)!==row.reference),entry=matches.length&&!conflict?matches[0]:fallback;
  return {value:row.reference,label:`${entry.name} · PHB${row.type!=='standard'?' · 需 DM 许可':''}`,entry,restricted:row.type!=='standard',unavailable:conflict?'此语言的资料身份或机械声明与已核对来源冲突，待适配。':!selectionEffectsAllowed(c,fallback)||!selectionEffectsAllowed(c,entry)?'此语言的来源或条目当前未启用。':undefined};
 });
}
/** Bounded display/dedup aliases only. Never authorizes an imported intent. */
export function reviewedLinguistLanguageReference(value:string):string|undefined{
 const normalized=value.trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ').toLowerCase(),parts=normalized.split('|').map(part=>part.trim());
 if(parts.length>2||parts.length===2&&parts[1]!=='phb')return;
 const name=parts[0];
 if(['auran','aquan','ignan','terran','气族语','水族语','火族语','土族语'].includes(name))return 'Primordial|PHB';
 return evidence.languages.find(row=>[row.english,row.name,row.reference.split('|')[0]].some(alias=>alias.toLowerCase()===name))?.reference;
}
function sourceFeat(c:Character,choiceId:string,entryId:string,active:Selection[]){
 const source=eligibleLegacySource(c,choiceId,active),entry=c.classChoiceSnapshots?.[entryId],rule=reviewedLinguistRule(entry);
 if(!source||!entry||entry.id!==entryId||!rule||!selectionEffectsAllowed(c,entry)||!selectionEffectsAllowed(c,{...entry,id:evidence.feat.entryId})||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==entryId)return;
 const {owner,row}=source;
 // Source aliases retain their imported instance identity, but cannot bypass
 // the canonical class/ASI disable boundary or become project-authored grants.
 const slots=evidence.legacyClassSlots.filter(slot=>slot.owner===`${owner.entry.english}|${owner.entry.source}`&&slot.level===source.level);
 if(owner.entry.packId!=='kiwee'||row.entry.packId!=='kiwee'||slots.length!==1||!selectionEffectsAllowed(c,{...owner.entry,id:slots[0].ownerEntryId})||!selectionEffectsAllowed(c,{...row.entry,id:slots[0].featureEntryId}))return;
 if(!absentOrEmpty(owner.entry.effects)||!absentOrEmpty(owner.entry.choices)||owner.entry.raw._category!=='class'||row.entry.raw._classEdition!==undefined&&row.entry.raw._classEdition!=='2014'||row.entry.raw.effects!==undefined||row.entry.raw.choices!==undefined||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw.source!==owner.entry.source||!['classic',undefined].includes(owner.entry.raw.edition)||row.entry.raw.ENG_name!==row.entry.english||row.entry.raw.source!==row.entry.source||!['classic',undefined].includes(row.entry.raw.edition)||row.entry.raw.className!==owner.entry.raw.name||row.entry.raw.classSource!==owner.entry.source)return;
 return {...source,entry,rule};
}
function eligibility(c:Character,choiceId:string,entryId:string,active=activeEffectSelections(c)){
 if(!automationEnabled(c))return {reason:'自动化当前未启用'};
 const grant=sourceFeat(c,choiceId,entryId,active);if(!grant)return {reason:'本次职业授予、所选语言学家、等级或来源当前不可用，或授予归属不明确'};
 if(active.some(row=>row.entry.id===evidence.feat.entryId||row.entry.english==='Linguist'&&row.entry.source==='PHB'||row.entry.raw.ENG_name==='Linguist'&&row.entry.raw.source==='PHB'))return {grant,reason:'同来源专长另有手工或导入条目，归属不明确；旧手工答案保留，未叠加新授予'};
 if(Object.entries(c.answers).filter(([id,ids])=>ids.length===1&&sourceFeat(c,id,ids[0],active)).length!==1)return {grant,reason:'PHB 语言学家不可重复，存在多份职业选择记录，未叠加效果'};
 return {grant};
}
export const reviewedLinguistGrantLevel=(c:Character,choiceId:string,entryId:string,active?:Selection[])=>sourceFeat(c,choiceId,entryId,active||activeEffectSelections(c))?.level;
export interface ReviewedLinguistComponentState {active:boolean;reason?:string;abilityBonus:number;abilityActive:boolean;languagesActive:boolean;languageReason?:string;abilityBefore?:number}
export function evaluateReviewedLinguist(c:Character,base:Record<Ability,number>,included?:Selection[],only?:ReviewedLinguistBinding){
 const bonuses=Object.fromEntries(ABILITIES.map(a=>[a,0])) as Record<Ability,number>,trace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const out={bonuses,trace,issues:[] as Issue[],states:new Map<string,ReviewedLinguistComponentState>(),languages:[] as {reference:string;label:string}[]};
 const store=c.reviewedLinguist;if(!store)return out;
 if(store.version!==1){out.issues.push({id:'reviewed-linguist-version',severity:'warning',message:'语言学家确认记录版本尚未支持，原记录保留且未生效。'});return out;}
 if(!reviewedLinguistStateValid(store)){out.issues.push({id:'reviewed-linguist-invalid',severity:'warning',message:'语言学家确认记录结构无效，原记录保留且未生效。'});return out;}
 const source=activeEffectSelections(c),safe=new Set(source.map(row=>row.id)),active=(included||source).filter(row=>safe.has(row.id));
 for(const binding of only?[only]:store.bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';else if(store.bindings.filter(row=>row.choiceId===binding.choiceId||row.selectionId===binding.selectionId).length!==1)reason='本次语言学家存在重复确认记录';else if(!Number.isSafeInteger(base.int))reason='此前智力值无效，未计算固定加值';}
  const blocked=!reason&&binding.intent.languages.find(ref=>!selectionEffectsAllowed(c,sourceEntry(ref))),languageReason=blocked?`${proof(blocked)!.name} 的来源或条目当前未启用，三种语言投影暂停；合法智力分量保留。`:undefined;
  const abilityBonus=reason?0:base.int<20?1:0,abilityActive=!reason,languagesActive=!reason&&!languageReason;
  out.states.set(`${binding.choiceId}|${binding.entryId}`,{active:abilityActive&&languagesActive,reason,abilityBonus,abilityActive,languagesActive,languageReason,abilityBefore:base.int});
  if(reason||languageReason)out.issues.push({id:`reviewed-linguist:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`语言学家${reason?'暂不生效':'语言分量暂停'}：${reason||languageReason}；原确认记录保留。`});
  if(!abilityActive)continue;
  const origin=`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）`;
  out.bonuses.int+=abilityBonus;out.trace.int.push(`${origin}：固定 INT +${abilityBonus}（上限 20，不降低已有属性）${abilityBonus===0?'；智力封顶不影响合法三语言':''}；密码与解码仍手工。`);
  if(languagesActive)for(const reference of binding.intent.languages)out.languages.push({reference,label:proof(reference)!.name});
 }
 return out;
}
export interface ReviewedLinguistStatus extends ReviewedLinguistComponentState {eligible:boolean;binding?:ReviewedLinguistBinding;selectionId?:string;rule?:ReviewedLinguistRule}
export function reviewedLinguistStatus(c:Character,choiceId:string,entryId:string):ReviewedLinguistStatus{
 const empty={eligible:false,active:false,abilityBonus:0,abilityActive:false,languagesActive:false};const store=c.reviewedLinguist;
 if(store&&store.version!==1)return {...empty,reason:'语言学家确认记录版本尚未支持，原记录保留。'};
 if(store&&!reviewedLinguistStateValid(store))return {...empty,reason:'语言学家确认记录结构无效，原记录保留。'};
 const current=eligibility(c,choiceId,entryId),grant=current.grant,binding=reviewedLinguistBindings(c).find(row=>row.choiceId===choiceId&&row.entryId===entryId),active=activeEffectSelections(c),base=baseAbilityScores(c,active).abilities;
 const state=binding?evaluateAbilityAdvancements(c,base,active).linguist.states.get(`${choiceId}|${entryId}`):undefined;
 const prior=grant?evaluateAbilityAdvancements(c,base,active,{level:grant.level,choiceId,entryId,selectionId:grant.row.id}):undefined,abilityBefore=prior?base.int+prior.asi.bonuses.int+prior.reviewed.bonuses.int+prior.linguist.bonuses.int+prior.observant.bonuses.int:base.int;
 return {...empty,eligible:!!grant&&!current.reason,abilityBefore,abilityBonus:!current.reason&&Number.isSafeInteger(abilityBefore)&&abilityBefore<20?1:0,...state,binding,reason:state?.reason||current.reason,selectionId:grant?.row.id,rule:grant?.rule};
}
export function reviewedLinguistLanguageRows(c:Character,active?:Selection[]):{reference:string;label:string}[]{
 if(c.training?.languages!==undefined)return [];
 const included=active||activeEffectSelections(c);return evaluateAbilityAdvancements(c,baseAbilityScores(c,included).abilities,included).linguist.languages;
}
/** Atomic ownership-only write; never migrate manual answers or resources. */
export function setReviewedLinguistIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedLinguistIntent|null,catalog:Entry[]=[]):void{
 const store=c.reviewedLinguist;if(store&&store.version!==1)throw Error('语言学家确认记录版本尚未支持，原记录保留。');if(store)validateReviewedLinguist(store);
 const other=(store?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);
 if(intent===null){if(store)c.reviewedLinguist={...store,bindings:other};return;}
 if(!validIntent(intent))throw Error('请确认三种不同的规范 PHB 语言、智力未计入手工值，以及本次受限语言的准确 DM 许可。');
 const current=eligibility(c,choiceId,entryId);if(!current.grant||current.reason)throw Error(current.reason||'本次语言学家授予当前不可用。');
 // Re-confirmation is not an ownership-repair operation. In particular, do
 // not filter duplicate saved claims away and silently reactivate this grant.
 const claims=(store?.bindings||[]).filter(row=>row.choiceId===choiceId||row.selectionId===current.grant!.row.id);
 if(claims.length>1)throw Error('本次语言学家存在重复授予确认，请先核对并明确撤回冲突记录，再重新确认；原记录保留。');
 if(claims.some(row=>row.choiceId===choiceId&&row.entryId===entryId&&row.selectionId!==current.grant!.row.id))throw Error('原语言学家确认不属于当前职业授予实例，请先核对并明确撤回旧记录，再重新确认；原记录保留。');
 const featMatches=catalog.filter(entry=>entry.id===evidence.feat.entryId||entry.id===entryId||entry.english==='Linguist'&&entry.source==='PHB'||entry.raw.ENG_name==='Linguist'&&entry.raw.source==='PHB');
 if(featMatches.some(entry=>!reviewedLinguistRule(entry)))throw Error('语言学家资料身份或机械声明冲突，待适配。');
 const options=reviewedLinguistOptions(c,catalog);for(const ref of intent.languages){const option=options.find(row=>row.value===ref);if(option?.unavailable)throw Error(option.unavailable);}
 const binding:ReviewedLinguistBinding={selectionId:current.grant.row.id,choiceId,entryId,intent:structuredClone(intent)},state:ReviewedLinguistState={version:1,bindings:[...other,binding]},base=baseAbilityScores(c,activeEffectSelections(c)).abilities,planned=evaluateAbilityAdvancements({...c,reviewedLinguist:state},base);
 const status=planned.linguist.states.get(`${choiceId}|${entryId}`);if(!status?.active)throw Error(status?.reason||status?.languageReason||'本次语言学家当前不能生效。');
 const before=evaluateAbilityAdvancements(c,base);
 for(const [key,value] of before.asi.states)if(value.active&&!planned.asi.states.get(key)?.active)throw Error('本次语言学家选择会令已有属性提升超过上限，请先调整原分配。');
 for(const [key,value] of before.reviewed.states)if(value.active&&!planned.reviewed.states.get(key)?.active)throw Error('本次语言学家选择会令已确认专长失效，请先调整原选择。');
 c.reviewedLinguist=state;
}
