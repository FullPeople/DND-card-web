import {selectionEffectsAllowed,type Character,type Entry,type Issue,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {eligibleLegacySource} from './asi';
import {automationEnabled} from './state';
import evidence from './reviewedSkilledEvidence.json' with {type:'json'};

export interface ReviewedSkilledChoice {kind:'skill'|'tool';reference:string}
export interface ReviewedSkilledIntent {kind:'skilled';choices:ReviewedSkilledChoice[];confirmed:true}
export interface ReviewedSkilledBinding {selectionId:string;choiceId:string;entryId:string;intent:ReviewedSkilledIntent}
/** Independent optional domain. Old passive-feat v1 readers retain this opaque
 * field rather than rejecting the whole character or suspending other feats. */
export interface ReviewedSkilledState {version:1;bindings:ReviewedSkilledBinding[]}
export interface ReviewedSkilledRule {kind:'skilled';reference:'Skilled|PHB';page:170}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;
 if(!object(a)&&!Array.isArray(a)||!object(b)&&!Array.isArray(b)||Array.isArray(a)!==Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&same(left[key],right[key]));
};
const metadata=new Set(['name','ENG_name','source','page','edition','entries','additionalEntries','srd','basicRules','referenceSources','reprintedAs','hasFluff','hasFluffImages','translator','otherSources','additionalSources','_category']);
const mechanics=(raw:Entry['raw'])=>Object.fromEntries(Object.entries(raw).filter(([key])=>!metadata.has(key)));
/** Only the frozen PHB shape, not a general executor for the mixed raw field. */
export function reviewedSkilledRule(entry:Entry|undefined):ReviewedSkilledRule|undefined{
 if(!entry)return;
 const raw=entry.raw;
 if(entry.kind!=='feat'||entry.english!=='Skilled'||entry.source!=='PHB'||entry.edition!=='2014'||entry.packId!=='kiwee'||raw.ENG_name!=='Skilled'||raw.source!=='PHB'||raw._category!=='feat'||entry.page!==170||raw.page!==170||entry.effects?.length||entry.choices?.length||entry.dependencies?.length)return;
 if(Object.keys(raw).some(key=>key!=='_category'&&!evidence.feat.rawKeys.includes(key))||!same(mechanics(raw),evidence.feat.mechanics))return;
 if(!Array.isArray(raw.entries)||raw.entries.length!==1||typeof raw.entries[0]!=='string'||!raw.entries[0].trim()||!entry.entries.length)return;
 if(raw.reprintedAs!==undefined&&(!Array.isArray(raw.reprintedAs)||raw.reprintedAs.length!==1||typeof raw.reprintedAs[0]!=='string'||!raw.reprintedAs[0].endsWith('|XPHB')))return;
 return {kind:'skilled',reference:'Skilled|PHB',page:170};
}
const proof=(choice:ReviewedSkilledChoice)=>choice.kind==='skill'?evidence.skills.find(row=>row.reference===choice.reference):evidence.tools.find(row=>row.reference===choice.reference)||evidence.vehicles.find(row=>row.reference===choice.reference);
function validChoice(value:unknown):value is ReviewedSkilledChoice{
 return object(value)&&['skill','tool'].includes(String(value.kind))&&typeof value.reference==='string'&&Object.keys(value).every(key=>['kind','reference'].includes(key))&&!!proof(value as unknown as ReviewedSkilledChoice);
}
export function reviewedSkilledChoicesValid(value:unknown):value is ReviewedSkilledChoice[]{
 return Array.isArray(value)&&value.length===3&&value.every(validChoice)&&new Set(value.map(row=>`${row.kind}:${row.reference}`)).size===3;
}
const validIntent=(value:unknown):value is ReviewedSkilledIntent=>object(value)&&value.kind==='skilled'&&value.confirmed===true&&reviewedSkilledChoicesValid(value.choices)&&Object.keys(value).every(key=>['kind','choices','confirmed'].includes(key));
export function validateReviewedSkilled(value:unknown):void{
 if(value===undefined)return;
 if(!object(value)||!Number.isSafeInteger(value.version)||Number(value.version)<1)throw Error('熟习确认记录版本无效。');
 if(value.version!==1)return;
 if(Object.keys(value).some(key=>!['version','bindings'].includes(key))||!Array.isArray(value.bindings)||value.bindings.length>100||value.bindings.some(row=>!object(row)||Object.keys(row).some(key=>!['selectionId','choiceId','entryId','intent'].includes(key))||['selectionId','choiceId','entryId'].some(key=>typeof row[key]!=='string'||!(row[key] as string).length||(row[key] as string).length>2000)||!validIntent(row.intent)))throw Error('熟习确认记录无效：需明确确认共三项不同的已核对技能或工具种类。');
}
function validStore(value:unknown):value is ReviewedSkilledState{
 if(!object(value)||value.version!==1)return false;
 try{validateReviewedSkilled(value);return true;}catch{return false;}
}
export const reviewedSkilledBindings=(c:Character):ReviewedSkilledBinding[]=>validStore(c.reviewedSkilled)?c.reviewedSkilled.bindings:[];
/** This compact source evidence represents proficiency KINDS, not inventory.
 * Vehicle kinds come from the PHB tool table, never from a cart/boat item. */
function sourceEntry(choice:ReviewedSkilledChoice):Entry{
 const row=proof(choice)!;
 if('key' in row)return {id:`reviewed-skilled:PHB:${row.key}`,kind:'rule',name:row.name,english:row.reference.split('|')[0],source:'PHB',edition:'2014',packId:'kiwee',revision:evidence.inputs['generated/gendata-tables.json'],page:154,entries:[],raw:{_category:'reviewedToolKind'}};
 return {id:row.entryId,kind:choice.kind==='skill'?'rule':'item',name:row.name,english:row.english,source:'PHB',edition:'2014',packId:'kiwee',revision:'entryHash' in row?row.entryHash:'',page:row.page,entries:[],raw:{name:row.name,ENG_name:row.english,source:'PHB',page:row.page,...('rawEdition' in row?{edition:row.rawEdition}:{}),...row.mechanics,_category:row.category}};
}
const vehicleHandleId=(key:string)=>`dnd-card.weapon-training:2014:${key}`;
/** The actual App catalog includes project-authored training category handles.
 * They are not publisher item rows. Authenticate only these two exact v2 PHB
 * handles, never all same-name rules or all authored equipment groups. */
const absentOrEmpty=(value:unknown)=>value===undefined||Array.isArray(value)&&value.length===0;
function vehicleReference(entry:Entry):ReviewedSkilledChoice|undefined{
 const row=evidence.vehicles.find(row=>entry.id===vehicleHandleId(row.key));
 if(!row||entry.kind!=='rule'||entry.packId!=='dnd-card.weapon-training'||entry.revision!=='2'||entry.english!==row.reference.split('|')[0]||entry.source!=='PHB'||entry.edition!=='2014'||entry.page!==undefined||!absentOrEmpty(entry.effects)||!absentOrEmpty(entry.choices)||!absentOrEmpty(entry.dependencies)||!same(entry.raw,{_category:'itemProperty',_trainingCategory:'tools',_authoredBy:'DND Card 项目整理'}))return;
 return {kind:'tool',reference:row.reference};
}
/** Both the historic table-backed identity and the App category handle refer
 * to this proficiency kind. Neither can bypass the other's disable boundary. */
function choiceAllowed(c:Character,choice:ReviewedSkilledChoice):boolean{
 const entry=sourceEntry(choice),row=choice.kind==='tool'?evidence.vehicles.find(row=>row.reference===choice.reference):undefined;
 return selectionEffectsAllowed(c,entry)&&(!row||selectionEffectsAllowed(c,{...entry,id:vehicleHandleId(row.key)}));
}
/** Validate catalog candidates independently. Renames are display-only; raw
 * source/edition, category, ID and all mechanics must retain reviewed identity. */
export function reviewedSkilledReference(entry:Entry):ReviewedSkilledChoice|undefined{
 const vehicle=vehicleReference(entry);if(vehicle)return vehicle;
 const row=evidence.skills.find(row=>row.entryId===entry.id)||evidence.tools.find(row=>row.entryId===entry.id);if(!row)return;
 const raw=entry.raw,kind=row.category==='skill'?'skill':'tool';
 if(entry.kind!==(kind==='skill'?'rule':'item')||entry.packId!=='kiwee'||entry.english!==row.english||raw.ENG_name!==row.english||entry.source!=='PHB'||raw.source!=='PHB'||entry.edition!=='2014'||entry.page!==row.page||raw.page!==row.page||raw._category!==row.category||raw.edition!==('rawEdition' in row?row.rawEdition:undefined)||entry.effects?.length||entry.choices?.length||entry.dependencies?.length)return;
 if(Object.keys(raw).some(key=>!['_category','entries','additionalEntries'].includes(key)&&!row.rawKeys.includes(key))||!same(mechanics(raw),row.mechanics))return;
 return {kind,reference:row.reference};
}
export interface ReviewedSkilledOption {value:string;label:string;choice:ReviewedSkilledChoice;entry:Entry;unavailable?:string}
export function reviewedSkilledOptions(c:Character,catalog:Entry[]=[]):ReviewedSkilledOption[]{
 const choices:ReviewedSkilledChoice[]=[...evidence.skills.map(row=>({kind:'skill' as const,reference:row.reference})),...evidence.tools.map(row=>({kind:'tool' as const,reference:row.reference})),...evidence.vehicles.map(row=>({kind:'tool' as const,reference:row.reference}))];
 return choices.map(choice=>{
  const fallback=sourceEntry(choice),vehicle=choice.kind==='tool'?evidence.vehicles.find(row=>row.reference===choice.reference):undefined,matches=catalog.filter(entry=>entry.id===fallback.id||vehicle&&entry.id===vehicleHandleId(vehicle.key)||entry.english===fallback.english&&entry.source==='PHB'),conflict=matches.some(entry=>!same(reviewedSkilledReference(entry),choice));
  const entry=matches.length&&!conflict?matches[0]:fallback;
  return {value:`${choice.kind}:${choice.reference}`,label:`${entry.name} · ${choice.kind==='skill'?'技能':'工具'} · PHB`,choice,entry,unavailable:conflict?'此种类的资料身份或机械声明与已核对来源冲突，待适配。':!choiceAllowed(c,choice)||!selectionEffectsAllowed(c,entry)?'此种类的来源或条目当前未启用。':undefined};
 });
}
function unavailable(c:Character,choices:ReviewedSkilledChoice[]){
 const stopped=choices.find(choice=>!choiceAllowed(c,choice));
 return stopped?`${proof(stopped)!.name} 的来源或条目当前未启用，三项熟练暂不生效。`:undefined;
}
function sourceFeat(c:Character,choiceId:string,entryId:string,active:Selection[]){
 const source=eligibleLegacySource(c,choiceId,active),entry=c.classChoiceSnapshots?.[entryId],rule=reviewedSkilledRule(entry);
 if(!source||!entry||entry.id!==entryId||!rule||!selectionEffectsAllowed(c,entry)||!selectionEffectsAllowed(c,{...entry,id:evidence.feat.entryId})||c.answers[choiceId]?.length!==1||c.answers[choiceId][0]!==entryId)return;
 const {owner,row}=source;
 if(owner.entry.effects?.length||owner.entry.choices?.length||owner.entry.raw._category!=='class'||row.entry.raw._classEdition!==undefined&&row.entry.raw._classEdition!=='2014'||row.entry.raw.effects!==undefined||row.entry.raw.choices!==undefined||owner.entry.raw.ENG_name!==owner.entry.english||owner.entry.raw.source!==owner.entry.source||!['classic',undefined].includes(owner.entry.raw.edition)||row.entry.raw.ENG_name!==row.entry.english||row.entry.raw.source!==row.entry.source||!['classic',undefined].includes(row.entry.raw.edition)||row.entry.raw.className!==owner.entry.raw.name||row.entry.raw.classSource!==owner.entry.source)return;
 return {...source,entry,rule};
}
function eligibility(c:Character,choiceId:string,entryId:string,active=activeEffectSelections(c)){
 if(!automationEnabled(c))return {reason:'自动化当前未启用'};
 const grant=sourceFeat(c,choiceId,entryId,active);if(!grant)return {reason:'本次职业授予、所选熟习、等级或来源当前不可用，或授予归属不明确'};
 if(active.some(row=>row.entry.kind==='feat'&&(row.entry.english==='Skilled'&&row.entry.source==='PHB'||row.entry.raw.ENG_name==='Skilled'&&row.entry.raw.source==='PHB')))return {grant,reason:'同来源专长另有手工或导入条目，归属不明确，未叠加效果'};
 if(Object.entries(c.answers).filter(([id,ids])=>ids.length===1&&sourceFeat(c,id,ids[0],active)).length!==1)return {grant,reason:'PHB 熟习不可重复，存在多份职业选择记录，未叠加效果'};
 return {grant};
}
export function evaluateReviewedSkilled(c:Character,included?:Selection[]){
 const out={skills:[] as {key:string;source:string}[],tools:[] as string[],toolLabels:[] as string[],trace:[] as string[],issues:[] as Issue[],states:new Map<string,{active:boolean;reason?:string}>()};
 const store=c.reviewedSkilled;if(!store)return out;
 if(store.version!==1){out.issues.push({id:'reviewed-skilled-version',severity:'warning',message:'熟习确认记录版本尚未支持，原记录保留且未生效。'});return out;}
 if(!validStore(store)){out.issues.push({id:'reviewed-skilled-invalid',severity:'warning',message:'熟习确认记录结构无效，原记录保留且未生效。'});return out;}
 const source=activeEffectSelections(c),safe=new Set(source.map(row=>row.id)),active=(included||source).filter(row=>safe.has(row.id));
 for(const binding of store.bindings){
  const current=eligibility(c,binding.choiceId,binding.entryId,active),grant=current.grant;let reason=current.reason;
  if(!reason&&grant){
   if(grant.row.id!==binding.selectionId)reason='原职业授予实例已不在，原记录保留';
   else if(store.bindings.filter(row=>row.choiceId===binding.choiceId||row.selectionId===binding.selectionId).length!==1)reason='本次熟习存在重复确认记录';
   else reason=unavailable(c,binding.intent.choices);
  }
  out.states.set(`${binding.choiceId}|${binding.entryId}`,{active:!reason,reason});
  if(reason){out.issues.push({id:`reviewed-skilled:${binding.choiceId}:${binding.entryId}`,selectionId:binding.selectionId,severity:'warning',message:`熟习暂不生效：${reason}；原确认记录保留。`});continue;}
  const origin=`${grant!.entry.name} · PHB（职业 ${grant!.level} 级选择）`;
  for(const choice of binding.intent.choices){if(choice.kind==='skill')out.skills.push({key:choice.reference,source:origin});else{out.tools.push(choice.reference);out.toolLabels.push(proof(choice)!.name);}}
  out.trace.push(`${origin}：已确认共三项技能或工具熟练，不授予专精${c.training?.tools!==undefined?'；手工工具训练覆盖保留':''}。`);
 }
 return out;
}
export function reviewedSkilledToolLabels(c:Character,active?:Selection[]):string[]{return c.training?.tools!==undefined?[]:evaluateReviewedSkilled(c,active).toolLabels;}
export interface ReviewedSkilledStatus {eligible:boolean;active:boolean;binding?:ReviewedSkilledBinding;reason?:string;selectionId?:string;rule?:ReviewedSkilledRule}
export function reviewedSkilledStatus(c:Character,choiceId:string,entryId:string):ReviewedSkilledStatus{
 const store=c.reviewedSkilled;
 if(store&&store.version!==1)return {eligible:false,active:false,reason:'熟习确认记录版本尚未支持，原记录保留。'};
 if(store&&!validStore(store))return {eligible:false,active:false,reason:'熟习确认记录结构无效，原记录保留。'};
 const current=eligibility(c,choiceId,entryId),binding=store?.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entryId),state=binding?evaluateReviewedSkilled(c).states.get(`${choiceId}|${entryId}`):undefined;
 return {eligible:!!current.grant&&!current.reason,active:state?.active??false,binding,reason:state?.reason||current.reason,selectionId:current.grant?.row.id,rule:current.grant?.rule};
}
/** Only the confirmation domain mutates. Existing proficiency/expertise, tools,
 * numerical overrides, items, abilities, HP and resource balances are untouched. */
export function setReviewedSkilledIntent(c:Character,choiceId:string,entryId:string,intent:ReviewedSkilledIntent|null):void{
 const store=c.reviewedSkilled;
 if(store&&store.version!==1)throw Error('熟习确认记录版本尚未支持，原记录保留。');
 if(store)validateReviewedSkilled(store);
 const other=(store?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);
 if(intent===null){if(store)c.reviewedSkilled={...store,bindings:other};return;}
 if(!validIntent(intent))throw Error('请明确确认共三项不同的已核对技能或工具种类。');
 const current=eligibility(c,choiceId,entryId);if(!current.grant||current.reason)throw Error(current.reason||'本次熟习授予当前不可用。');
 const binding:ReviewedSkilledBinding={selectionId:current.grant.row.id,choiceId,entryId,intent:structuredClone(intent)},state:ReviewedSkilledState={version:1,bindings:[...other,binding]};
 const planned=evaluateReviewedSkilled({...c,reviewedSkilled:state}).states.get(`${choiceId}|${entryId}`);if(!planned?.active)throw Error(planned?.reason||'本次熟习当前不能生效。');
 c.reviewedSkilled=state;
}
