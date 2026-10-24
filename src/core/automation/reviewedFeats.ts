import {evaluateAbilityAdvancements} from './abilityAdvancements';
import {ABILITIES,selectionEffectsAllowed,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {evaluate} from '../engine';
import {automationEnabled} from './state';
import {eligibleLegacySource} from './asi';
import evidence from './reviewedFeatEvidence.json' with {type:'json'};

export type ReviewedFeatIntent={kind:'tough';confirmedManualHpExcluded:true}|{kind:'resilient';ability:Ability;confirmedManualAbilityExcluded:true};
export interface ReviewedFeatBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedFeatIntent}
export interface ReviewedFeatState {version:1;bindings:ReviewedFeatBinding[]}
export interface ReviewedFeatRule {kind:'tough'|'resilient';reference:string;page:number}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const abilities=(v:unknown)=>Array.isArray(v)&&v.length===6&&new Set(v).size===6&&ABILITIES.every(a=>v.includes(a));
/** Exact raw and normalized identities plus reviewed mechanical shapes, never a
 * label-triggered or general raw-field executor. Publisher prose is not bundled. */
export function reviewedFeatRule(entry:Entry):ReviewedFeatRule|undefined{
 const r=entry.raw;
 if(entry.kind!=='feat'||entry.edition!=='2014'||entry.source!=='PHB'||r.source!=='PHB'||r._category!=='feat'||entry.english!==r.ENG_name||entry.effects?.length||entry.choices?.length)return;
 const rule=evidence.rules.find(row=>row.english===entry.english);if(!rule||r.page!==rule.page||entry.page!==rule.page)return;
 if(Object.keys(r).some(key=>!['name','ENG_name','source','page','reprintedAs','entries','translator','_category',...(rule.kind==='resilient'?['ability','savingThrowProficiencies']:[])].includes(key)))return;
 if(!Array.isArray(r.entries)||!r.entries.length||!entry.entries.length)return;
 if(r.reprintedAs!==undefined&&(!Array.isArray(r.reprintedAs)||r.reprintedAs.length!==1||typeof r.reprintedAs[0]!=='string'||!r.reprintedAs[0].endsWith('|XPHB')))return;
 if(rule.kind==='tough'&&(r.entries.length!==1||typeof r.entries[0]!=='string'||!r.entries[0].trim()))return;
 if(rule.kind==='resilient'){
  if(r.entries.length!==2||typeof r.entries[0]!=='string'||!r.entries[0].trim()||!object(r.entries[1])||r.entries[1].type!=='list'||Object.keys(r.entries[1]).some(key=>!['type','items'].includes(key))||!Array.isArray(r.entries[1].items)||r.entries[1].items.length!==1||typeof r.entries[1].items[0]!=='string'||!r.entries[1].items[0].trim())return;
  if(!Array.isArray(r.ability)||r.ability.length!==1||!object(r.ability[0])||Object.keys(r.ability[0]).length!==1||!object(r.ability[0].choose))return;
  const choice=r.ability[0].choose;
  if(Object.keys(choice).some(key=>!['from','amount','entry'].includes(key))||choice.amount!==1||!abilities(choice.from)||choice.entry!==undefined&&typeof choice.entry!=='string')return;
  if(!same(r.savingThrowProficiencies,[{choose:{from:choice.from}}]))return;
 }
 return {kind:rule.kind as ReviewedFeatRule['kind'],reference:rule.reference,page:rule.page};
}
function validIntent(value:unknown):value is ReviewedFeatIntent{
 return object(value)&&(value.kind==='tough'&&value.confirmedManualHpExcluded===true&&Object.keys(value).every(k=>['kind','confirmedManualHpExcluded'].includes(k))||value.kind==='resilient'&&ABILITIES.includes(value.ability as Ability)&&value.confirmedManualAbilityExcluded===true&&Object.keys(value).every(k=>['kind','ability','confirmedManualAbilityExcluded'].includes(k)));
}
/** Saved effects follow source availability rather than the new-entry filter. */
function activeSources(c:Character):Selection[]{
 return c.selections.filter(row=>{let current:Selection|undefined=row;const seen=new Set<string>();while(current){if(seen.has(current.id)||!selectionEffectsAllowed(c,current.entry))return false;seen.add(current.id);if(!current.parentId)return true;current=c.selections.find(parent=>parent.id===current!.parentId);}return false;});
}
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
export function evaluateReviewedFeats(c:Character,base:Record<Ability,number>,included?:Selection[],only?:ReviewedFeatBinding){
 const bonuses=Object.fromEntries(ABILITIES.map(a=>[a,0])) as Record<Ability,number>,trace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const saves=new Set<Ability>(),saveTrace=Object.fromEntries(ABILITIES.map(a=>[a,[] as string[]])) as Record<Ability,string[]>;
 const issues:Issue[]=[],states=new Map<string,{active:boolean;reason?:string}>(),out={bonuses,trace,saves,saveTrace,hpBonus:0,hpTrace:[] as string[],issues,states};
 if(!c.reviewedFeats)return out;
 if(c.reviewedFeats.version!==1){issues.push({id:'reviewed-feat-version',severity:'warning',message:'此已核对专长记录版本尚未支持，原记录保留且未生效。'});return out;}
 const source=activeSources(c),safe=new Set(source.map(row=>row.id)),active=(included||source).filter(row=>safe.has(row.id));
 const bindings=c.reviewedFeats.bindings;
 for(const binding of only?[only]:bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){
   if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';
   else if(!validIntent(binding.intent)||binding.intent.kind!==grant.rule.kind)reason='专长确认或属性选择记录无效';
   else if(bindings.filter(row=>row.choiceId===binding.choiceId&&row.entryId===binding.entryId).length!==1)reason='本次专长存在重复确认记录';
   else if(binding.intent.kind==='resilient'&&(!Number.isFinite(base[binding.intent.ability])||base[binding.intent.ability]+1>20))reason='所选属性已达到或将超过上限 20，请调整选择或手工基础值；不会降低已有属性';
   else if(binding.intent.kind==='tough'&&active.filter(row=>row.entry.kind==='class').some(row=>!Number.isSafeInteger(row.level)||row.level<1||row.level>20))reason='角色职业等级无效，未计算生命值加值';
  }
  states.set(`${binding.choiceId}|${binding.entryId}`,{active:!reason,reason});
  if(reason){issues.push({id:`reviewed-feat:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`已核对专长暂不生效：${reason}；原确认记录保留。`});continue;}
  const origin=`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）`;
  if(binding.intent.kind==='tough'){
   const level=active.filter(row=>row.entry.kind==='class').reduce((sum,row)=>sum+row.level,0);out.hpBonus+=2*level;out.hpTrace.push(`${origin}：已确认未计入手工生命值，角色总等级 ${level} × 2 = +${2*level}`);
  }else{
   const ability=binding.intent.ability;bonuses[ability]+=1;trace[ability].push(`${origin}：显式选择 +1（上限 20）`);saves.add(ability);saveTrace[ability].push(`${origin}：同一属性豁免熟练${c.proficiencies?.[`save:${ability}`]===false?'，手工不熟练覆盖保留':''}`);
  }
 }
 return out;
}
export interface ReviewedFeatStatus {eligible:boolean;active:boolean;binding?:ReviewedFeatBinding;reason?:string;selectionId?:string;rule?:ReviewedFeatRule}
export function reviewedFeatStatus(c:Character,choiceId:string,entryId:string):ReviewedFeatStatus{
 if(c.reviewedFeats&&c.reviewedFeats.version!==1)return {eligible:false,active:false,reason:'此已核对专长记录版本尚未支持，原记录保留。'};
 const {grant,reason}=eligibility(c,choiceId,entryId),binding=c.reviewedFeats?.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entryId);
 const state=binding?evaluateAbilityAdvancements(c,evaluate({...c,asiAllocations:undefined,reviewedFeats:undefined}).abilities).reviewed.states.get(`${choiceId}|${entryId}`):undefined;
 return {eligible:!!grant&&!reason,active:state?.active??false,binding,reason:state?.reason||reason,selectionId:grant?.row.id,rule:grant?.rule};
}
/** One explicit owned intent; no manual score, HP, proficiency or runtime write. */
export function setReviewedFeatIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedFeatIntent|null):void{
 if(c.reviewedFeats&&c.reviewedFeats.version!==1)throw Error('此已核对专长记录版本尚未支持，原记录保留。');
 const other=(c.reviewedFeats?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);
 if(intent===null){if(c.reviewedFeats)c.reviewedFeats={...c.reviewedFeats,bindings:other};return;}
 if(!validIntent(intent))throw Error('请先明确确认尚未计入手工数值，并为强健身心选择一项属性。');
 const {grant,reason}=eligibility(c,choiceId,entryId);if(!grant||reason)throw Error(reason||'本次专长授予当前不可用。');
 if(intent.kind!==grant.rule.kind)throw Error('确认类型与所选专长不一致。');
 const binding:ReviewedFeatBinding={selectionId:grant.row.id,choiceId,entryId,intent:{...intent}},state:ReviewedFeatState={...c.reviewedFeats,version:1,bindings:[...other,binding]};
 const base=evaluate({...c,asiAllocations:undefined,reviewedFeats:undefined}).abilities,allPlanned=evaluateAbilityAdvancements({...c,reviewedFeats:state},base),planned=allPlanned.reviewed.states.get(`${choiceId}|${entryId}`);
 if(!planned?.active)throw Error(planned?.reason||'此专长当前不能生效。');
 const before=evaluateAbilityAdvancements(c,base);
 for(const [key,status] of before.asi.states)if(status.active&&!allPlanned.asi.states.get(key)?.active)throw Error('本次专长选择会令已有属性提升超过上限，请先调整原分配。');
 for(const [key,status] of before.reviewed.states)if(key!==`${choiceId}|${entryId}`&&status.active&&!allPlanned.reviewed.states.get(key)?.active)throw Error('本次选择会令另一项已确认专长失效，请先调整原选择。');
 c.reviewedFeats=state;
}
export function validateReviewedFeats(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('已核对专长记录版本无效。');
 if(value.version!==1)return;
 if(!Array.isArray(value.bindings)||value.bindings.length>100||value.bindings.some(row=>!object(row)||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)))throw Error('已核对专长确认记录无效。');
}
