import {ABILITIES,selectionEffectsAllowed,type Character,type Entry,type Selection} from '../model';
import {candidateReason,evaluate} from '../engine';
import {resolveEntryReference,matchesReference} from '../entryReferences';
import {legacyFeatEvidence,modernFeatEvidence,legacyRecordSupport,optionalChoiceSupport,fightingStylePrerequisiteEvidence,fightingStyleAlternativeEvidence,type ClassChoiceSupport} from './classChoiceSupport';
import type {ChoiceOption,SheetChoice} from './choices';

const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const key=(value:unknown)=>String(value??'').trim().toLowerCase();
const level=(row:Selection)=>Number.isSafeInteger(row.level)&&row.level>=1&&row.level<=20?row.level:0;
const names=(entry:Entry)=>[entry.name,entry.english,entry.raw.name,entry.raw.ENG_name].map(key);
const abilityImprovement=(entry:Entry)=>key(entry.raw.category)==='g'&&entry.raw.repeatable===true&&list(entry.raw.ability).some((row:any)=>Array.isArray(row?.choose?.from)&&row.choose.from.length>0&&row.choose.from.every((ability:any)=>ABILITIES.includes(ability))&&(row.choose.amount??1)*(row.choose.count??1)===2);
function activeOwnedFeat(c:Character,entry:Entry,reference:string):boolean{
 const parts=reference.split('|');
 if(parts.length>2||!parts[0].trim())return false;
 const qualified=`${parts[0]}|${parts[1]?.trim()||'PHB'}`;
 return c.selections.some(row=>{
  if(row.entry.kind!=='feat'||row.entry.id===entry.id||!matchesReference(row.entry,qualified)||
   row.entry.edition!=='both'&&row.entry.edition!==(entry.edition==='both'?c.edition:entry.edition))return false;
  const seen=new Set<string>();let current:Selection|undefined=row;
  while(current){
   if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;
   seen.add(current.id);if(!current.parentId)return true;
   current=c.selections.find(parent=>parent.id===current!.parentId);
  }
  return false;
 });
}
/** The existing typed feat-filter syntax; it is not an additional grant. */
export function sourceFeatFilterCategory(text:unknown):string|undefined{
 if(typeof text!=='string'||!/(?:获得|选择).*(?:一项|一个|1)/.test(text))return;
 return text.match(/\{@filter ([^|}]+)\|feats\|category=([^|}]+)/)?.[2].trim().toLowerCase();
}
function linkedClassFeatFilters(c:Character,owner:Selection,known:Entry[],group:{name?:string;ENG_name?:string;category?:unknown},atGrant:number):string[]{
 const groupNames=[group.name,group.ENG_name].map(key).filter(Boolean),categories=list(group.category).map(key);
 if(!groupNames.length)return [];
 const refs=list(owner.entry.raw.classFeatures).flatMap(raw=>{const ref=typeof raw==='string'?raw:raw&&typeof raw==='object'?(raw as {classFeature?:unknown}).classFeature:undefined;return typeof ref==='string'&&Number(ref.split('|')[3])===atGrant?[ref]:[];});
 const features=c.selections.filter(row=>row.parentId===owner.id&&row.entry.kind==='feature'&&key(row.entry.source)===key(owner.entry.source)&&names(row.entry).some(name=>groupNames.includes(name))&&refs.some(ref=>row.grantKey===`ref:${ref}`&&resolveEntryReference(ref,known,'feature')?.id===row.entry.id));
 if(features.length!==1)return []; // Ambiguous or unrelated rewards stay separate.
 const feature=features[0];
 return feature.entry.entries.flatMap((text,index)=>{
  const category=sourceFeatFilterCategory(text);if(!category||!categories.includes(category))return [];
  const matchingGroups=list(owner.entry.raw.featProgression).filter((raw:any)=>raw&&[raw.name,raw.ENG_name].map(key).filter(Boolean).some(name=>names(feature.entry).includes(name))&&list(raw.category).map(key).includes(category)&&raw.progression?.[String(atGrant)]===1);
  return matchingGroups.length===1?[`${feature.id}:filter:${index}`]:[];
 });
}
/** Sparse optional-feature progressions carry the most recent declared total. */
export function sourceProgressionCount(value:unknown,at:number):number|undefined{
 let count:unknown;
 if(Array.isArray(value))count=value[at-1];
 else if(value&&typeof value==='object'){
  const steps=Object.keys(value).filter(k=>/^\d+$/.test(k)&&Number(k)>=1&&Number(k)<=at).map(Number).sort((a,b)=>b-a);
  count=steps.length?(value as Record<string,unknown>)[String(steps[0])]:0;
 }
 return Number.isSafeInteger(count)&&Number(count)>=0&&Number(count)<=100?Number(count):undefined;
}
/** Only an active, declared source grant can satisfy the reviewed prerequisite.
 * A matching display name, manual copy, future reference or dismissed grant cannot.
 */
function ownedFightingStylePrerequisite(c:Character,owner:Selection,known:Entry[],required?:string){
 if(!level(owner)||!selectionEffectsAllowed(c,owner.entry))return;
 const refs=list(owner.entry.raw.classFeatures).flatMap(raw=>{const ref=typeof raw==='string'?raw:raw&&typeof raw==='object'?(raw as {classFeature?:unknown}).classFeature:undefined;return typeof ref==='string'?[ref]:[];});
 return c.selections.find(row=>row.parentId===owner.id&&row.entry.kind==='feature'&&row.entry.raw._category==='classFeature'&&selectionEffectsAllowed(c,row.entry)&&
  !!fightingStylePrerequisiteEvidence(owner.entry,row.entry)&&Number(row.entry.raw.level)<=level(owner)&&
  !c.dismissedFeatures?.includes(`${owner.id}|${row.grantKey}`)&&(!required||names(row.entry).includes(key(required)))&&
  refs.some(ref=>row.grantKey===`ref:${ref}`&&resolveEntryReference(ref,known,'feature')?.id===row.entry.id));
}
/** Unknown prerequisite shapes remain unavailable; a choice never repairs them. */
export function sourceChoicePrerequisite(c:Character,entry:Entry,owner:Selection,optional:boolean,known:Entry[]=c.selections.map(row=>row.entry)):string|undefined{
 const alternatives=entry.raw.prerequisite;if(alternatives===undefined)return;
 if(!Array.isArray(alternatives)||!alternatives.length)return '此前置条件结构尚未核对。';
 let scores:ReturnType<typeof evaluate>['abilities']|undefined;
 const check=(rule:Record<string,unknown>):string|undefined=>{
  for(const [field,value] of Object.entries(rule)){
   if(field==='level'){
    let required:unknown=value,actual=optional?level(owner):c.selections.filter(s=>s.entry.kind==='class').reduce((n,s)=>n+level(s),0);
    if(value&&typeof value==='object'){
     const v=value as {level?:unknown;class?:{name?:unknown;ENG_name?:unknown;source?:unknown}};required=v.level;
     if(!v.class)return '此等级前置的职业范围尚未核对。';
     const declared=[v.class.name,v.class.ENG_name].map(key).filter(Boolean);
     const parent=c.selections.find(s=>s.entry.kind==='class'&&declared.some(n=>names(s.entry).includes(n))&&key(s.entry.source)===key(v.class!.source));actual=parent?level(parent):0;
    }
    if(!Number.isSafeInteger(required)||Number(required)<1)return '此等级前置结构尚未核对。';
    if(actual<Number(required))return `尚未达到所需${optional?'职业':''}等级 ${required}。`;
   }else if(field==='ability'){
    scores??=evaluate(c).abilities;
    const groups=list(value) as Record<string,unknown>[];
    const current=scores;
    if(!groups.length||!groups.some(group=>Object.entries(group).every(([ability,minimum])=>Object.hasOwn(current,ability)&&typeof minimum==='number'&&current[ability as keyof typeof current]>=minimum)))return '尚未满足属性前置条件。';
   }else if(field==='feat'&&!optional){
    if(!Array.isArray(value)||!value.length||value.some(ref=>typeof ref!=='string'||!ref.trim()||!ref.split('|')[0].trim()||ref.split('|').length>2))return '此专长前置结构尚未核对。';
    if(!value.some(ref=>activeOwnedFeat(c,entry,ref)))return '尚未具备来源和版本匹配且当前有效的所需专长。';
   }else if(field==='feature'&&!optional&&key(entry.raw.category)==='fs'){
    if(!Array.isArray(value)||value.length!==1||typeof value[0]!=='string'||!value[0].trim())return '此特性前置结构尚未核对。';
    if(!ownedFightingStylePrerequisite(c,owner,known,value[0]))return '尚未具备来源明确授予且当前有效的所需职业特性。';
   }else if(field==='otherSummary'&&!optional){
    const feature=ownedFightingStylePrerequisite(c,owner,known),evidence=feature&&fightingStyleAlternativeEvidence(owner.entry,feature.entry,entry);
    if(!feature||!evidence||!value||typeof value!=='object'||Array.isArray(value))return '此前置条件仍需手动核对，不能由本入口确认。';
    const summary=value as Record<string,unknown>,keys=Object.keys(summary);
    // These two reviewed alternatives state the same source-qualified class
    // feature and level already proved above. Recognize only that exact shape;
    // arbitrary otherSummary prose never becomes a prerequisite interpreter.
    const expected=`当你获得${evidence.level}级${feature.entry.raw.className}\"${feature.entry.raw.name}\"特性时`;
    if(keys.length!==2||!keys.includes('entry')||!keys.includes('entrySummary')||summary.entry!==expected||summary.entrySummary!=='特殊')return '此前置条件仍需手动核对，不能由本入口确认。';
   }else if(field==='item'&&optional&&list(entry.raw.featureType).some(type=>key(type)==='ai')){
    // Infusion target restrictions belong to activation, not the learned list.
    if(!Array.isArray(value))return '物品条件结构尚未核对。';
   }else return '此前置条件仍需手动核对，不能由本入口确认。';
  }
 };
 const results=alternatives.map(rule=>rule&&typeof rule==='object'&&!Array.isArray(rule)?check(rule):'此前置条件结构尚未核对。');
 return results.some(reason=>reason===undefined)?undefined:results[0];
}

export function sourceClassChoices(c:Character,known:Entry[]):SheetChoice[]{
 known=[...Object.values(c.classChoiceSnapshots||{}),...known];
 const out:SheetChoice[]=[];
 for(const owner of c.selections.filter(row=>row.entry.kind==='class')){
  const restricted=!selectionEffectsAllowed(c,owner.entry),at=level(owner);
  const sourceCard={...c,edition:owner.entry.edition==='both'?c.edition:owner.entry.edition,profile:{...c.profile,optional:{...c.profile.optional,legacy:false}}};
  const add=(id:string,label:string,count:number,candidates:Entry[],optional:boolean,hint?:string,recordOnly=optional,support?:ClassChoiceSupport,duplicateChoiceIds:string[]=[])=>{
   candidates=candidates.filter((entry,index)=>candidates.findIndex(other=>other.id===entry.id)===index);
   const saved=c.answers[id]??duplicateChoiceIds.flatMap(alias=>c.answers[alias]||[]),options:ChoiceOption[]=candidates.map(entry=>({value:entry.id,label:entry.name,entry,
    grant:recordOnly?undefined:entry,unavailable:candidateReason({...sourceCard,selections:c.selections.filter(s=>s.requirementId!==id&&!duplicateChoiceIds.includes(s.requirementId||''))},entry)||sourceChoicePrerequisite(c,entry,owner,optional,known)}));
   const slots=Array.from({length:Math.max(count,saved.length)},(_,index)=>saved[index]||'');
   const selected=restricted?[]:saved.slice(0,count).filter((value,index,values)=>options.some(option=>option.value===value&&!option.unavailable)&&(values.indexOf(value)===index||options.find(option=>option.value===value)?.entry.raw.repeatable===true));
   out.push({id,ownerId:owner.id,label,count,options,slots,selected,complete:selected.length===count&&count>0,restricted,channel:'content',catalogKind:optional?'feature':'feat',sourceProgression:optional?'optional':'feat',ownerEdition:owner.entry.edition,support,duplicateChoiceIds,
    hint:hint||(optional?'数量来自此职业的来源声明。这里只保存已学记录；不会激活灌注物品、生成物品或返还资源。替换次数、重复子选项及具体机制需手动核对；调整记录不代表规则允许替换。':undefined)});
  };
  list(owner.entry.raw.optionalfeatureProgression).forEach((raw,index)=>{
   if(!raw||typeof raw!=='object')return;const group=raw as {name?:string;featureType?:unknown;progression?:unknown};
   const types=list(group.featureType).filter((type):type is string=>typeof type==='string').map(key),count=sourceProgressionCount(group.progression,at);
   if(count===0&&!c.answers[`${owner.id}:class-optional:${index}`]?.some(Boolean))return;
   const candidates=types.length?known.filter(entry=>entry.kind==='feature'&&entry.raw._category==='optionalfeature'&&list(entry.raw.featureType).some(type=>types.includes(key(type)))&&(entry.edition==='both'||entry.edition===owner.entry.edition)):[];
   add(`${owner.id}:class-optional:${index}`,group.name||'职业可选特性',count??0,count===undefined?[]:candidates,true,count===undefined?'此来源的进度结构尚未核对；已有记录保留。':undefined,true,optionalChoiceSupport(owner.entry,types,count??0,at));
  });
  list(owner.entry.raw.featProgression).forEach((raw,index)=>{
   if(!raw||typeof raw!=='object')return;const group=raw as {name?:string;ENG_name?:string;category?:unknown;progression?:unknown};
   if(!group.progression||typeof group.progression!=='object'||Array.isArray(group.progression))return;
   const categories=list(group.category).filter((category):category is string=>typeof category==='string').map(key);
   for(const [step,value] of Object.entries(group.progression)){
    const grantedAt=Number(step);if(!/^\d+$/.test(step)||!Number.isSafeInteger(grantedAt)||grantedAt<1||!Number.isSafeInteger(value)||Number(value)<1||Number(value)>100)continue;
    const unrestrictedCategory=categories.includes('eb')&&owner.entry.edition==='2024'&&grantedAt===19;
    const candidates=known.filter(entry=>entry.kind==='feat'&&(categories.includes(key(entry.raw.category))||unrestrictedCategory)&&(entry.edition==='both'||entry.edition===owner.entry.edition));
    for(let slot=0;slot<Number(value);slot++){
     const id=`${owner.id}:class-feat:${index}:${step}:${slot}`;
     const aliases=Number(value)===1?linkedClassFeatFilters(c,owner,known,group,grantedAt):[];
     if(grantedAt>at&&!c.answers[id]?.some(Boolean)&&!aliases.some(alias=>c.answers[alias]?.some(Boolean)))continue;
     add(id,`${group.name||'职业专长'}（职业 ${step} 级）`,grantedAt<=at?1:0,candidates,false,undefined,false,undefined,aliases);out.at(-1)!.grantLevel=grantedAt;
    }
   }
  });
  // A typed feat reference supplies the grant identity. No class/feature names
  // or arbitrary prose determine a quota. Legacy untyped links stay pending.
  for(const raw of list(owner.entry.raw.classFeatures)){
   const ref=typeof raw==='string'?raw:raw&&typeof raw==='object'?(raw as {classFeature?:unknown}).classFeature:undefined;
   if(typeof ref!=='string')continue;
   const atGrant=Number(ref.split('|')[3]);if(!Number.isSafeInteger(atGrant)||atGrant<1)continue;
   const feature=resolveEntryReference(ref,known,'feature');if(!feature)continue;
   if(legacyFeatEvidence(owner.entry,feature)){
    const id=`${owner.id}:class-legacy-feat:${feature.id}`;if(atGrant>at&&!c.answers[id]?.some(Boolean))continue;
    const ability:Entry={...feature,id:`${owner.entry.id}#legacy-ability-record`,name:'属性提升（手动填写）',english:'Recorded ability improvement',entries:['保存本次属性提升方案；请在卡面手动填写属性，不重复叠加。'],raw:{_choiceConcept:true,_classAbilityRecord:true},effects:undefined,choices:undefined};
    const feats=known.filter(entry=>entry.kind==='feat'&&(entry.edition==='both'||entry.edition===owner.entry.edition));
    add(id,`${feature.name} / 可选专长（职业 ${atGrant} 级）`,atGrant<=at?1:0,[ability,...feats],false,'选择属性提升方案，或在规则设置允许可选专长时记录替代专长。这里只保存方案；属性及专长效果仍手动处理。',true,legacyRecordSupport);
    out.at(-1)!.evidenceEntries=[feature];out.at(-1)!.grantLevel=atGrant;
    continue;
   }
   const typed=feature.entries.flatMap(node=>typeof node==='string'?[...node.matchAll(/\{@feat ([^}]+)\}/g)].map(match=>resolveEntryReference(match[1],known,'feat')):[]).filter((entry):entry is Entry=>!!entry);
   const grant=typed.find(abilityImprovement);
   if(!grant){
    if(atGrant<=at&&feature.entries.some(node=>typeof node==='string'&&/\{@5etools [^|}]+\|feats\.html\}/.test(node))&&typed.length===0){
     add(`${owner.id}:class-untyped-feat:${feature.id}`,`${feature.name}（职业 ${atGrant} 级，待核对）`,0,[],false,'此来源只有专长目录链接。2014 属性提升与替换专长需手动核对和填写，本入口不会授予能力或改写属性。');out.at(-1)!.grantLevel=atGrant;
    }
    continue;
   }
   const id=`${owner.id}:class-typed-feat:${feature.id}`;
   if(atGrant>at&&!c.answers[id]?.some(Boolean))continue;
   const candidates=known.filter(entry=>entry.kind==='feat'&&(entry.edition==='both'||entry.edition===owner.entry.edition));
   add(id,`${feature.name}（职业 ${atGrant} 级）`,atGrant<=at?1:0,candidates,false,'记录本次职业授予的专长；只有既有已适配机制生效。ASI 属性分配仍手动填写，不会重复改变卡面基础属性。',false,{rule:modernFeatEvidence(owner.entry,feature)?'verified':'source-declared',execution:'existing-grants',publication:'unverified',reason:'专长选择关联已实现；仅既有已适配机制生效，ASI 属性仍手动填写。'});
   // The chosen feat can differ from the typed ASI identity. Preserve both
   // references so catalog absence cannot turn a confirmed grant into no grant.
   out.at(-1)!.evidenceEntries=[feature,grant];out.at(-1)!.grantLevel=atGrant;
  }
 }
 // Record-only legacy feats do not enter selections. Their active answers must
 // still reserve a nonrepeatable feat across independent class grants. Old
 // duplicates remain recorded; only the first eligible grant is active.
 const claimed=new Map<string,string>();
 for(const choice of out)if(choice.sourceProgression==='feat'&&!choice.restricted&&choice.count>0)
  for(const value of choice.selected){const entry=choice.options.find(option=>option.value===value)?.entry;if(entry?.kind==='feat'&&entry.raw.repeatable!==true&&!claimed.has(entry.id))claimed.set(entry.id,choice.id);}
 for(const choice of out)if(choice.sourceProgression==='feat'){
  for(const option of choice.options)if(option.entry.kind==='feat'&&option.entry.raw.repeatable!==true&&claimed.has(option.entry.id)&&claimed.get(option.entry.id)!==choice.id)
   option.unavailable||='此不可重复专长已在其他有效职业授予中选择；原记录保留。';
  choice.selected=choice.selected.filter(value=>choice.options.some(option=>option.value===value&&!option.unavailable));
  choice.complete=choice.selected.length===choice.count&&choice.count>0;
 }
 return out;
}
