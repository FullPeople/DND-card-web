import {evaluateAbilityAdvancements,type AdvancementBoundary} from './abilityAdvancements';
import {ABILITIES,selectionEffectsAllowed,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {baseAbilityScores} from './baseAbilities';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {eligibleLegacySource} from './asi';
import {trainingDeclarations} from './training';
import {equipmentTraining} from '../proficiencyText';
import {reviewedWeaponReferencesValid,reviewedWeaponUnavailable,reviewedWeaponNeedsFirearmsConsent} from './reviewedWeapons';
import evidence from './reviewedFeatEvidence.json' with {type:'json'};

export type ReviewedArmorFeatKind='lightly-armored'|'moderately-armored'|'heavily-armored';
export type ReviewedWeaponMasterIntent={kind:'weapon-master';ability:'str'|'dex';weapons:string[];confirmedManualAbilityExcluded:true;confirmedDmFirearmsAllowed?:true};
export type ReviewedFeatIntent=ReviewedWeaponMasterIntent|{kind:'tough';confirmedManualHpExcluded:true}|{kind:'resilient';ability:Ability;confirmedManualAbilityExcluded:true}|{kind:ReviewedArmorFeatKind;ability:'str'|'dex';confirmedManualAbilityExcluded:true};
export interface ReviewedFeatBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedFeatIntent}
export interface ReviewedFeatState {version:1;bindings:ReviewedFeatBinding[]}
/** Separate from v1 passive feats: older consumers must not suspend existing
 * Tough/Resilient/armor training merely because Weapon Master was confirmed. */
export interface ReviewedWeaponMasterState {version:1;bindings:ReviewedFeatBinding[]}
export function reviewedFeatBindings(c:Character):ReviewedFeatBinding[]{return [...(c.reviewedFeats?.version===1?c.reviewedFeats.bindings:[]),...(validWeaponMasterStore(c.reviewedWeaponMaster)?c.reviewedWeaponMaster!.bindings:[])];}
export interface ReviewedFeatRule {kind:'tough'|'resilient'|'weapon-master'|ReviewedArmorFeatKind;reference:string;page:number;abilities?:Ability[];armorTraining?:string[];requiredArmor?:'light'|'medium';weaponCount?:number}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const abilities=(v:unknown)=>Array.isArray(v)&&v.length===6&&new Set(v).size===6&&ABILITIES.every(a=>v.includes(a));
/** Exact raw and normalized identities plus reviewed mechanical shapes, never a
 * label-triggered or general raw-field executor. Publisher prose is not bundled. */
export function reviewedFeatRule(entry:Entry|undefined):ReviewedFeatRule|undefined{
 if(!entry)return;
 const r=entry.raw;
 if(entry.kind!=='feat'||entry.edition!=='2014'||entry.source!=='PHB'||r.source!=='PHB'||r._category!=='feat'||entry.english!==r.ENG_name||entry.effects?.length||entry.choices?.length)return;
 const rule=evidence.rules.find(row=>row.english===entry.english);if(!rule||r.page!==rule.page||entry.page!==rule.page)return;
 if(Object.keys(r).some(key=>!['name','ENG_name','source','page','reprintedAs','entries','translator','_category',...(rule.kind==='resilient'?['ability','savingThrowProficiencies']:rule.kind==='weapon-master'?['ability','weaponProficiencies']:'armorTraining' in rule?['ability','armorProficiencies',...('requiredArmor' in rule?['prerequisite']:[])]:[])].includes(key)))return;
 if(!Array.isArray(r.entries)||!r.entries.length||!entry.entries.length)return;
 if(r.reprintedAs!==undefined&&(!Array.isArray(r.reprintedAs)||r.reprintedAs.length!==1||typeof r.reprintedAs[0]!=='string'||!r.reprintedAs[0].endsWith('|XPHB')))return;
 if(rule.kind==='tough'&&(r.entries.length!==1||typeof r.entries[0]!=='string'||!r.entries[0].trim()))return;
 if(rule.kind==='resilient'||rule.kind==='weapon-master'||'armorTraining' in rule){
  if(r.entries.length!==2||typeof r.entries[0]!=='string'||!r.entries[0].trim()||!object(r.entries[1])||r.entries[1].type!=='list'||Object.keys(r.entries[1]).some(key=>!['type','items'].includes(key))||!Array.isArray(r.entries[1].items)||r.entries[1].items.length!==1||typeof r.entries[1].items[0]!=='string'||!r.entries[1].items[0].trim())return;
  if(rule.kind==='heavily-armored'){
   if(!same(r.ability,[{str:1}]))return;
  }else{
   if(!Array.isArray(r.ability)||r.ability.length!==1||!object(r.ability[0])||Object.keys(r.ability[0]).length!==1||!object(r.ability[0].choose))return;
   const choice=r.ability[0].choose;
   if(Object.keys(choice).some(key=>!['from','amount','entry'].includes(key))||choice.amount!==1||choice.entry!==undefined&&typeof choice.entry!=='string')return;
   if(rule.kind==='resilient'){
    if(!abilities(choice.from)||!same(r.savingThrowProficiencies,[{choose:{from:choice.from}}]))return;
   }else if(!same(choice.from,['str','dex']))return;
  }
  if(rule.kind==='weapon-master'&&!same(r.ability,[{choose:{from:['str','dex'],amount:1}}]))return;
  if(rule.kind==='weapon-master'&&!same(r.weaponProficiencies,[{choose:{fromFilter:rule.weaponFilter,count:rule.weaponCount}}]))return;
  if('armorTraining' in rule){
   if(!same(r.armorProficiencies,[Object.fromEntries(rule.armorTraining!.map(category=>[category,true]))]))return;
   if('requiredArmor' in rule&&!same(r.prerequisite,[{proficiency:[{armor:rule.requiredArmor}]}]))return;
  }
 }
 return {kind:rule.kind as ReviewedFeatRule['kind'],reference:rule.reference,page:rule.page,...(rule.kind==='weapon-master'?{abilities:rule.abilities as Ability[],weaponCount:rule.weaponCount}:{}),...('armorTraining' in rule?{abilities:rule.abilities as Ability[],armorTraining:rule.armorTraining,...('requiredArmor' in rule?{requiredArmor:rule.requiredArmor as 'light'|'medium'}:{})}:{})};
}
function validIntent(value:unknown):value is ReviewedFeatIntent{
 if(object(value)&&value.kind==='weapon-master')return ['str','dex'].includes(String(value.ability))&&value.confirmedManualAbilityExcluded===true&&reviewedWeaponReferencesValid(value.weapons)&&(value.confirmedDmFirearmsAllowed===undefined||value.confirmedDmFirearmsAllowed===true)&&Object.keys(value).every(k=>['kind','ability','weapons','confirmedManualAbilityExcluded','confirmedDmFirearmsAllowed'].includes(k));
 return object(value)&&(value.kind==='tough'&&value.confirmedManualHpExcluded===true&&Object.keys(value).every(k=>['kind','confirmedManualHpExcluded'].includes(k))||(value.kind==='resilient'&&ABILITIES.includes(value.ability as Ability)||['lightly-armored','moderately-armored'].includes(String(value.kind))&&['str','dex'].includes(String(value.ability))||value.kind==='heavily-armored'&&value.ability==='str')&&value.confirmedManualAbilityExcluded===true&&Object.keys(value).every(k=>['kind','ability','confirmedManualAbilityExcluded'].includes(k)));
}
/** Saved effects follow source availability rather than the new-entry filter. */
const activeSources=activeEffectSelections;
function sourceFeat(c:Character,choiceId:string,entryId:string,active:Selection[]){
 const source=eligibleLegacySource(c,choiceId,active),entry=c.classChoiceSnapshots?.[entryId],rule=entry&&reviewedFeatRule(entry);
 if(!source||!entry||entry.id!==entryId||!rule||!selectionEffectsAllowed(c,entry)||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==entryId)return;
 // The existing legacy source adapter also supplies raw/normalized ownership.
 // Refuse a forged normalized PHB label over an unknown raw source identity.
 const {owner,row}=source;
 if(owner.entry.effects?.length||owner.entry.choices?.length||owner.entry.raw._category!=='class'||row.entry.raw._classEdition!==undefined&&row.entry.raw._classEdition!=='2014'||row.entry.raw.effects!==undefined||row.entry.raw.choices!==undefined||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw.source!==owner.entry.source||!['classic',undefined].includes(owner.entry.raw.edition)||row.entry.raw.ENG_name!==row.entry.english||row.entry.raw.source!==row.entry.source||!['classic',undefined].includes(row.entry.raw.edition)||row.entry.raw.className!==owner.entry.raw.name||row.entry.raw.classSource!==owner.entry.source)return;
 return {...source,entry,rule};
}
function sameIdentity(entry:Entry,reference:string){
 const [english,source]=reference.split('|');return entry.kind==='feat'&&((entry.english===english&&entry.source===source)||(entry.raw.ENG_name===english&&entry.raw.source===source));
}
function eligibility(c:Character,choiceId:string,entryId:string,active=activeSources(c)){
 if(!automationEnabled(c))return {reason:'自动化当前未启用'};
 const grant=sourceFeat(c,choiceId,entryId,active);if(!grant)return {reason:'本次职业授予、所选专长、等级或来源当前不可用，或授予归属不明确'};
 if(active.some(row=>sameIdentity(row.entry,grant.rule.reference)))return {grant,reason:'同来源专长另有手工或导入条目，归属不明确，未叠加效果'};
 const claimed=Object.entries(c.answers).filter(([id,ids])=>ids.length===1&&sourceFeat(c,id,ids[0],active)?.rule.reference===grant.rule.reference);
 if(claimed.length!==1)return {grant,reason:'同来源不可重复专长存在多份职业选择记录，未叠加效果'};
 return {grant};
}
export const reviewedFeatGrantLevel=(c:Character,choiceId:string,entryId:string,active?:Selection[])=>sourceFeat(c,choiceId,entryId,active||activeSources(c))?.level;
export function evaluateReviewedFeats(c:Character,base:Record<Ability,number>,included?:Selection[],only?:ReviewedFeatBinding,priorArmor:string[]=[],before?:AdvancementBoundary){
 const bonuses=Object.fromEntries(ABILITIES.map(a=>[a,0])) as Record<Ability,number>,trace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const saves=new Set<Ability>(),saveTrace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const issues:Issue[]=[],states=new Map<string,{active:boolean;reason?:string}>(),out={bonuses,trace,saves,saveTrace,hpBonus:0,hpTrace:[] as string[],issues,states,armorTraining:[] as string[],armorTrace:[] as string[],weaponTraining:[] as string[],weaponTrace:[] as string[]};
 if(!c.reviewedFeats&&!c.reviewedWeaponMaster)return out;
 if(c.reviewedFeats&&c.reviewedFeats.version!==1)issues.push({id:'reviewed-feat-version',severity:'warning',message:'此已核对专长记录版本尚未支持，原记录保留且未生效。'});
 if(c.reviewedWeaponMaster&&c.reviewedWeaponMaster.version!==1)issues.push({id:'reviewed-weapon-master-version',severity:'warning',message:'武器大师确认记录版本尚未支持，原记录保留且未生效。'});
 else if(c.reviewedWeaponMaster&&!validWeaponMasterStore(c.reviewedWeaponMaster))issues.push({id:'reviewed-weapon-master-invalid',severity:'warning',message:'武器大师确认记录结构无效，原记录保留且未生效。'});
 const source=activeSources(c),safe=new Set(source.map(row=>row.id)),active=(included||source).filter(row=>safe.has(row.id));
 const bindings=reviewedFeatBindings(c);
 for(const binding of only?[only]:bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){
   if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';
   else if(!validIntent(binding.intent)||binding.intent.kind!==grant.rule.kind||binding.intent.kind==='weapon-master'&&!(c.reviewedWeaponMaster?.version===1&&c.reviewedWeaponMaster.bindings.includes(binding))||binding.intent.kind!=='weapon-master'&&!(c.reviewedFeats?.version===1&&c.reviewedFeats.bindings.includes(binding)))reason='专长确认或属性选择记录无效';
   else if(bindings.filter(row=>row.choiceId===binding.choiceId&&row.entryId===binding.entryId).length!==1)reason='本次专长存在重复确认记录';
   else if(binding.intent.kind!=='tough'&&(!Number.isFinite(base[binding.intent.ability])||base[binding.intent.ability]+1>20))reason='所选属性已达到或将超过上限 20，请调整选择或手工基础值；不会降低已有属性';
   else if(binding.intent.kind==='weapon-master'&&reviewedWeaponNeedsFirearmsConsent(binding.intent.weapons)&&binding.intent.confirmedDmFirearmsAllowed!==true)reason='所选火器熟练需要明确确认 DM 已允许，请核对后重新确认。';
   else if(binding.intent.kind==='weapon-master'&&reviewedWeaponUnavailable(c,binding.intent.weapons))reason=reviewedWeaponUnavailable(c,binding.intent.weapons);
   else if(grant.rule.requiredArmor&&!new Set(trainingDeclarations(c,active,'armor',priorArmor,before).map(value=>equipmentTraining(value)?.[0])).has(grant.rule.requiredArmor))reason=`尚未具备此前授予时有效的${grant.rule.requiredArmor==='light'?'轻甲':'中甲'}熟练；后续或自身训练不能满足此前置`;
   else if(binding.intent.kind==='tough'&&active.filter(row=>row.entry.kind==='class').some(row=>!Number.isSafeInteger(row.level)||row.level<1||row.level>20))reason='角色职业等级无效，未计算生命值加值';
  }
  states.set(`${binding.choiceId}|${binding.entryId}`,{active:!reason,reason});
  if(reason){issues.push({id:`reviewed-feat:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`已核对专长暂不生效：${reason}；原确认记录保留。`});continue;}
  const origin=`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）`;
  if(binding.intent.kind==='tough'){
   const level=active.filter(row=>row.entry.kind==='class').reduce((sum,row)=>sum+row.level,0);out.hpBonus+=2*level;out.hpTrace.push(`${origin}：已确认未计入手工生命值，角色总等级 ${level} × 2 = +${2*level}`);
  }else{
   const ability=binding.intent.ability;bonuses[ability]+=1;trace[ability].push(`${origin}：显式选择 +1（上限 20）`);
   if(binding.intent.kind==='resilient'){saves.add(ability);saveTrace[ability].push(`${origin}：同一属性豁免熟练${c.proficiencies?.[`save:${ability}`]===false?'，手工不熟练覆盖保留':''}`);}
   else if(binding.intent.kind==='weapon-master'){out.weaponTraining.push(...binding.intent.weapons);out.weaponTrace.push(`${origin}：四种武器熟练${c.training?.weapons!==undefined?'，手工武器训练覆盖保留':''}`);}
   else{out.armorTraining.push(...grant!.rule.armorTraining!);out.armorTrace.push(`${origin}：护甲熟练${c.training?.armor!==undefined?'，手工护甲训练覆盖保留':''}`);}
  }
 }
 return out;
}
export interface ReviewedFeatStatus {eligible:boolean;active:boolean;binding?:ReviewedFeatBinding;reason?:string;selectionId?:string;rule?:ReviewedFeatRule}
export function reviewedFeatStatus(c:Character,choiceId:string,entryId:string):ReviewedFeatStatus{
 const weaponMaster=reviewedFeatRule(c.classChoiceSnapshots?.[entryId]!)?.kind==='weapon-master'||validWeaponMasterStore(c.reviewedWeaponMaster)&&c.reviewedWeaponMaster!.bindings.some(row=>row.choiceId===choiceId&&row.entryId===entryId);
 const store=weaponMaster?c.reviewedWeaponMaster:c.reviewedFeats;
 if(store&&store.version!==1)return {eligible:false,active:false,reason:'此已核对专长记录版本尚未支持，原记录保留。'};
 if(weaponMaster&&store&&!validWeaponMasterStore(store))return {eligible:false,active:false,reason:'武器大师确认记录结构无效，原记录保留。'};
 const current=eligibility(c,choiceId,entryId),grant=current.grant,binding=store?.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entryId),active=activeEffectSelections(c),base=baseAbilityScores(c,active).abilities;
 let reason=current.reason;
 if(grant?.rule.requiredArmor&&!reason){
  const boundary={level:grant.level,choiceId,selectionId:grant.row.id},prior=evaluateAbilityAdvancements(c,base,active,boundary).reviewed.armorTraining;
  if(!trainingDeclarations(c,active,'armor',prior,boundary).some(value=>equipmentTraining(value)?.[0]===grant.rule.requiredArmor))reason=`尚未具备此前授予时有效的${grant.rule.requiredArmor==='light'?'轻甲':'中甲'}熟练。`;
 }
 const state=binding?evaluateAbilityAdvancements(c,base,active).reviewed.states.get(`${choiceId}|${entryId}`):undefined;
 return {eligible:!!grant&&!reason,active:state?.active??false,binding,reason:state?.reason||reason,selectionId:grant?.row.id,rule:grant?.rule};
}
/** One explicit owned intent; no manual score, HP, proficiency or runtime write. */
export function setReviewedFeatIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedFeatIntent|null):void{
 const weaponMaster=intent?.kind==='weapon-master'||reviewedFeatRule(c.classChoiceSnapshots?.[entryId]!)?.kind==='weapon-master'||validWeaponMasterStore(c.reviewedWeaponMaster)&&c.reviewedWeaponMaster!.bindings.some(row=>row.choiceId===choiceId&&row.entryId===entryId);
 const field=weaponMaster?'reviewedWeaponMaster':'reviewedFeats',store=c[field];
 if(store&&store.version!==1)throw Error('此已核对专长记录版本尚未支持，原记录保留。');
 if(weaponMaster&&store)validateReviewedWeaponMaster(store);
 const other=(store?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);
 if(intent===null){if(store)c[field]={...store,bindings:other};return;}
 if(!validIntent(intent))throw Error('请先明确确认尚未计入手工数值，并选择此专长允许的一项属性及四种不同武器（如适用）。');
 const {grant,reason}=eligibility(c,choiceId,entryId);if(!grant||reason)throw Error(reason||'本次专长授予当前不可用。');
 if(intent.kind!==grant.rule.kind)throw Error('确认类型与所选专长不一致。');
 const binding:ReviewedFeatBinding={selectionId:grant.row.id,choiceId,entryId,intent:structuredClone(intent)},state:ReviewedFeatState={...store,version:1,bindings:[...other,binding]};
 const base=baseAbilityScores(c,activeEffectSelections(c)).abilities,allPlanned=evaluateAbilityAdvancements({...c,[field]:state},base),planned=allPlanned.reviewed.states.get(`${choiceId}|${entryId}`);
 if(!planned?.active)throw Error(planned?.reason||'此专长当前不能生效。');
 const before=evaluateAbilityAdvancements(c,base);
 for(const [key,status] of before.asi.states)if(status.active&&!allPlanned.asi.states.get(key)?.active)throw Error('本次专长选择会令已有属性提升超过上限，请先调整原分配。');
 for(const [key,status] of before.reviewed.states)if(key!==`${choiceId}|${entryId}`&&status.active&&!allPlanned.reviewed.states.get(key)?.active)throw Error('本次选择会令另一项已确认专长失效，请先调整原选择。');
 c[field]=state;
}
export function validateReviewedFeats(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('已核对专长记录版本无效。');
 if(value.version!==1)return;
 if(!Array.isArray(value.bindings)||value.bindings.length>100||value.bindings.some(row=>!object(row)||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||(!validIntent(row.intent)||row.intent.kind==='weapon-master')))throw Error('已核对专长确认记录无效。');
}

export function validateReviewedWeaponMaster(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('武器大师确认记录版本无效。');
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','bindings'].includes(key))||!Array.isArray(value.bindings)||value.bindings.length>100||value.bindings.some(row=>!object(row)||Object.keys(row).some(key=>!['selectionId','choiceId','entryId','intent'].includes(key))||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)||row.intent.kind!=='weapon-master'))throw Error('武器大师确认记录无效。');
}

function validWeaponMasterStore(value:unknown):value is ReviewedWeaponMasterState{
 if(!object(value)||value.version!==1)return false;
 try{validateReviewedWeaponMaster(value);return true;}catch{return false;}
}
