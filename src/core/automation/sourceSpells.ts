import {irMechanics,irParentClass,irSelectionActive,irAbilityScores,irAmount} from './ir';
import {evaluate} from '../engine';
import {sourceOwnerIdentity,rememberSourceSpellUses} from './sourceSpellState';
import {ABILITIES,selectionAllowed,type Ability,type Character,type Entry,type Issue,type Selection,type SpecialSpell} from '../model';
import {matchesReference} from '../entryReferences';
import {parentClass} from '../featureOwnership';
import {casterProfiles} from '../spellcastingRules';
import {spellState} from '../characterDetails';
import {specialSpellResource} from '../spellResourceKeys';
import {activeSelections} from './active';
import {automationEnabled,supportedAutomation} from './state';

export const sourceSpellKey=(key?:string)=>!!key?.startsWith('source-spell:');
export interface SourceSpellPlan {id:string;owner:Selection;key:string;entry:Entry;eligible:boolean;config:SpecialSpell}
export interface SourceSpellChoice {ownerId:string;key:string;label:string;sets?:string[];abilities?:Ability[];usageModes?:boolean;spells?:string[];count?:number}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Typed IR grants only; existing receipt codecs remain stable across the upgrade. */
export function planSourceSpells(c:Character,catalog:Entry[]=[]):{grants:SourceSpellPlan[];issues:Issue[];choices:SourceSpellChoice[]}{
 const grants:SourceSpellPlan[]=[],issues:Issue[]=[],choices:SourceSpellChoice[]=[];
 if(!supportedAutomation(c))return {grants,issues,choices};
 const known=[...new Map([...catalog,...c.selections.map(s=>s.entry)].filter(entry=>entry.kind==='spell').map(entry=>[entry.id,entry])).values()];
 const uid=(entry:Entry)=>`${entry.automation?.identity.engName||entry.english}|${entry.automation?.identity.source||entry.source}`;
 for(const owner of c.selections){
  const specs=(irMechanics(owner.entry)?.grants||[]).filter(grant=>grant.type==='spell');
  const issue=(key:string,message:string)=>{const id=`source-spell:${owner.id}:${key}`;if(!issues.some(row=>row.id===id))issues.push({id,selectionId:owner.id,severity:'warning',message:`${owner.entry.name}：${message}`});};
  for(const gap of owner.entry.automation?.unsupported||[])if(gap.family==='additionalSpells'&&gap.code!=='spell-usage-pool-ambiguous')issue(gap.code,gap.code==='spell-frequency'?'法术次数公式未支持。':`赠送法术声明未支持（${gap.code}），需手动核对。`);
  const setOptions=[...new Set(specs.filter(grant=>grant.setKey==='additionalSpells').map(grant=>grant.setOption!))].sort((a,b)=>a-b);
  if(setOptions.length>1)choices.push({ownerId:owner.id,key:owner.id,label:owner.entry.name+'的施法方案',sets:Array.from({length:Math.max(...setOptions)+1},(_,i)=>`方案 ${i+1}`)});
  for(const [index,spec]of specs.entries()){
   if(spec.setKey==='additionalSpells'&&spec.setOption!==c.automation?.spellSets?.[owner.id]){if(c.automation?.spellSets?.[owner.id]===undefined)issue('set','请选择施法方案；原记录保留。');continue;}
   if(spec.usage==='expanded'){issue(spec.key||String(index),'扩展法表只声明候选范围，需在法术页选择。');continue;}
   const cls=irParentClass(c,owner),profiles=casterProfiles(c).filter(p=>!cls||p.owner.id===cls.id),level=cls?.level??Math.max(1,c.selections.filter(s=>s.entry.kind==='class'&&irSelectionActive(c,s)).reduce((n,s)=>n+s.level,0));
   const eligible=(spec.atLevel===undefined||level>=spec.atLevel)&&(spec.atSpellLevel===undefined||profiles.some(p=>p.maxLevel>=spec.atSpellLevel!));
   const typedKey=spec.key||`source-spell:ir/${index}`,pool=spec.usagePool||typedKey.replace(/\/\d+$/,''),parts=/^source-spell:(\d+)\/(known|prepared|innate|expanded)\/([^/]+)\/(.+)\/(\d+)$/.exec(typedKey);
   const blockIndex=parts?.[1]||String(spec.setOption||0),abilityKey=`${owner.id}:${blockIndex}`;
   let ability:Ability|undefined=typeof spec.ability==='string'?spec.ability as Ability:undefined;
   if(spec.ability&&typeof spec.ability==='object'){const options=spec.ability.choose as Ability[];if(!choices.some(choice=>choice.key===abilityKey))choices.push({ownerId:owner.id,key:abilityKey,label:owner.entry.name+'的施法属性',abilities:options});const chosen=c.automation?.spellAbilities?.[abilityKey];if(chosen&&options.includes(chosen))ability=chosen;else issue(abilityKey,'请选择施法属性，暂不猜测攻击与 DC。');}
   if(!spec.ability&&cls){const declared=irMechanics(profiles[0]?.casting.entry||cls.entry)?.classModel?.spellcastingAbility;if(ABILITIES.includes(declared as Ability))ability=declared as Ability;}
   const candidates=known.filter(entry=>{
    const record=entry.automation,model=irMechanics(entry)?.spellModel;if(!record||!model)return false;
    if(spec.fixed||spec.choose?.from)return [...(spec.fixed||[]),...(spec.choose?.from||[])].includes(record.identity.key);
    const filter=spec.choose?.filter;if(!filter)return false;
    return (entry.edition==='both'||entry.edition===owner.entry.edition)&&(filter.level===undefined||model.level===filter.level)&&(filter.school===undefined||model.school===filter.school)&&(!filter.source||(Array.isArray(filter.source)?filter.source:[filter.source]).includes(entry.source))&&(!filter.class||model.classes?.some(clazz=>clazz.engName===filter.class&&(!filter.classSource||clazz.source===filter.classSource)));
   });
   if(candidates.some(entry=>candidates.filter(other=>other.automation!.identity.key===entry.automation!.identity.key).length>1)){issue(typedKey,'法术引用存在多个身份，未自动任选一条。');continue;}
   if(spec.fixed?.some(key=>!candidates.some(entry=>entry.automation?.identity.key===key)))issue(typedKey,'赠送法术引用尚未加载；记录与消耗保留。');
   let selected=candidates;
   if(spec.choose){
    const key=JSON.stringify([sourceOwnerIdentity(c,owner),parts?`source-spell:${blockIndex}/${parts[2]}/${parts[3]}/${parts[4]}/choose:${parts[5]}`:typedKey]);
    const refs=candidates.map(entry=>spec.referenceAliases?.[entry.automation!.identity.key]?decodeURIComponent(spec.referenceAliases[entry.automation!.identity.key]):uid(entry));choices.push({ownerId:owner.id,key,label:owner.entry.name+'的赠送法术',spells:refs,count:spec.choose.count});const saved=c.automation?.spellChoices?.[key]||[];
    if(saved.length>spec.choose.count||new Set(saved).size!==saved.length||saved.some(value=>!refs.includes(value)&&!candidates.some(entry=>entry.automation?.identity.key===value))){issue(key,'保存的选择与当前声明不符，未执行；记录保留。');continue;}
    selected=candidates.filter(entry=>saved.includes(spec.referenceAliases?.[entry.automation!.identity.key]?decodeURIComponent(spec.referenceAliases[entry.automation!.identity.key]):uid(entry))||saved.includes(entry.automation!.identity.key));if(selected.length<spec.choose.count)issue(key,`赠送法术尚有 ${spec.choose.count-selected.length} 项未选。`);
   }
   let shared=false;const modeKey=JSON.stringify([sourceOwnerIdentity(c,owner),pool]);
   if(spec.ambiguous){const names=[...new Set((irMechanics(owner.entry)?.grants||[]).filter(grant=>grant.type==='spell'&&grant.usagePool===spec.usagePool).flatMap(grant=>Object.values(grant.referenceAliases||{}).map(value=>decodeURIComponent(value).split('|')[0])))];if(!choices.some(choice=>choice.key===modeKey))choices.push({ownerId:owner.id,key:modeKey,label:owner.entry.name+'的次数归属'+(names.length?'：'+names.join('、'):''),usageModes:true});const mode=c.automation?.spellUsageModes?.[modeKey];if(!mode){issue(modeKey,'多个法术的次数归属未明确，请核对原文后选择各自次数或共用次数。');continue;}shared=mode==='shared';}
   for(const entry of selected){
    const ref=spec.referenceAliases?.[entry.automation!.identity.key]?decodeURIComponent(spec.referenceAliases[entry.automation!.identity.key]):uid(entry)+(spec.spellLevel?`#${spec.spellLevel}`:''),key=parts?`source-spell:${blockIndex}/${parts[2]}/${parts[3]}/${parts[4]}/${ref.toLowerCase()}`:`${typedKey}/${entry.automation!.identity.key}`,id=`auto-spell:${owner.id}:${encodeURIComponent(key)}`,usageKey=JSON.stringify([sourceOwnerIdentity(c,owner),shared?pool:key]);
    let maximum:number|undefined;if(spec.uses)try{maximum=irAmount(c,owner,spec.uses.max,irAbilityScores(c));if(!Number.isSafeInteger(maximum)||maximum<1||maximum>100)throw Error();}catch{issue(typedKey,'法术次数公式尚未绑定。');continue;}
    const period=spec.uses?.recovery.find(rule=>rule.amount==='all'&&['short','long'].includes(rule.period))?.period;
    if(spec.uses&&!period){issue(typedKey,'此恢复机制需手动处理。');continue;}
    if(spec.resource){issue(typedKey,'物品充能施法需绑定明确付款资源，尚未自动执行。');continue;}
    const active=automationEnabled(c)&&irSelectionActive(c,owner)&&eligible&&selectionAllowed(c,entry),usage=spec.usage==='ritual'?'ritual':spec.usage==='free'||maximum?'free':spec.canUseSlots?(irMechanics(entry)?.spellModel?.level===0?'free':'slot'):'check';
    const config:SpecialSpell={mode:maximum?'uses':'locked',...(maximum?{max:maximum,recovery:period as 'short'|'long'}:{}),label:spec.origin==='prepared'?'始终预备':maximum?'来源次数施法':'来源法术',sourceGrant:{ownerId:owner.id,key,usageKey,...(shared?{resourceKey:`source-spell-pool:${encodeURIComponent(usageKey)}`}:{ }),canUseSlots:!!spec.canUseSlots,ability,active,usage,castLevel:spec.spellLevel,reason:active?undefined:!automationEnabled(c)?'自动计算已关闭':!eligible?'尚未达到来源等级':'来源或依赖未启用'}};
    grants.push({id,owner,key,entry,eligible,config});
   }
  }
 }
 return {grants,issues,choices};
}

/** Reconcile explicit source grants. Resources initialize only when a grant first appears. */
export function syncSourceSpells(c:Character,catalog:Entry[]):boolean{
 if(!supportedAutomation(c))return false;
 const fingerprint=()=>JSON.stringify([c.selections.filter(s=>sourceSpellKey(s.grantKey)).map(s=>[s.id,c.spellSettings?.special?.[s.id],c.runtime.resources[specialSpellResource(s.id,c)]]),c.spellSettings?.prepared,c.runtime.sourceSpellSpent]);
 const before=fingerprint();rememberSourceSpellUses(c,undefined,true);const plan=planSourceSpells(c,catalog),matched=new Set<string>();
 // Explicit old-card review removals remain removed after a late catalog recovery.
 // Ordinary version retirement does not create this receipt.
 plan.grants=plan.grants.filter(grant=>!c.dismissedFeatures?.includes(grant.owner.id+'|'+grant.key));
 const transfers=new Map<string,{max:number;old:Set<string>}>();
 for(const grant of plan.grants){const old=c.spellSettings?.special?.[grant.id];if(old?.mode!=='uses'||grant.config.mode!=='uses')continue;
  const previousKey=specialSpellResource(grant.id,c),nextKey=grant.config.sourceGrant?.resourceKey||`innate-spell:${grant.id}`;
  if(previousKey===nextKey)continue;const transfer=transfers.get(nextKey)||{max:grant.config.max!,old:new Set<string>()};transfer.old.add(previousKey);transfers.set(nextKey,transfer);
 }
 for(const [key,transfer] of transfers){
  const debt=(resourceKey:string)=>Math.max(...Object.entries(c.spellSettings?.special||{}).filter(([id])=>specialSpellResource(id,c)===resourceKey).map(([,config])=>c.runtime.sourceSpellSpent?.[config.sourceGrant?.usageKey||'']||0),0,c.runtime.resources[resourceKey]?Math.max(0,c.runtime.resources[resourceKey].max-c.runtime.resources[resourceKey].current):transfer.max);
  const spent=[...transfer.old].reduce((sum,k)=>sum+debt(k),0),preserved=Math.max(spent,c.runtime.resources[key]?debt(key):0);
  c.runtime.resources[key]={...c.runtime.resources[key],max:transfer.max,current:Math.max(0,transfer.max-preserved),type:'count'};
  for(const grant of plan.grants)if((grant.config.sourceGrant?.resourceKey||`innate-spell:${grant.id}`)===key&&grant.config.sourceGrant?.usageKey)(c.runtime.sourceSpellSpent||={})[grant.config.sourceGrant.usageKey]=Math.max(preserved,c.runtime.sourceSpellSpent[grant.config.sourceGrant.usageKey]||0);
 }


 for(const grant of plan.grants){
  let row=c.selections.find(s=>s.id===grant.id);
  if(!row&&(!grant.eligible||!grant.config.sourceGrant?.active))continue;
  const fresh=!row;
  if(!row){if(c.selections.length>=3000)continue;row={id:grant.id,entry:structuredClone(grant.entry),quantity:1,level:1,equipped:false,parentId:grant.owner.id,grantKey:grant.key};c.selections.push(row);}
  const settings=c.spellSettings||=structuredClone(spellState(c));(settings.special||={})[row.id]=grant.config;
  settings.prepared=settings.prepared.map(id=>id===row!.id?'':id);matched.add(row.id);
  if(grant.config.mode==='uses'){
   const key=specialSpellResource(row.id,c),resource=c.runtime.resources[key],max=grant.config.max!;
   // A missing counter on an already saved grant is not permission to replenish it.
   if(!resource)c.runtime.resources[key]={name:grant.config.sourceGrant?.resourceKey?`${grant.owner.entry.name}共享施法次数`:`${row.entry.name} · ${grant.owner.entry.name}`,max,current:!fresh?0:c.runtime.sourceSpellSpent?.[grant.config.sourceGrant!.usageKey!]!==undefined?Math.max(0,max-c.runtime.sourceSpellSpent[grant.config.sourceGrant!.usageKey!]):max,type:'count'};
   else {resource.name||=grant.config.sourceGrant?.resourceKey?`${grant.owner.entry.name}共享施法次数`:`${row.entry.name} · ${grant.owner.entry.name}`;if(resource.max!==max){const spent=Math.max(0,resource.max-resource.current,resource.current===0?c.runtime.sourceSpellSpent?.[grant.config.sourceGrant!.usageKey!]||0:0);resource.max=max;resource.current=Math.max(0,max-spent);}}
  }
 }
 for(const row of c.selections.filter(s=>sourceSpellKey(s.grantKey)&&!matched.has(s.id))){
  const config=c.spellSettings?.special?.[row.id];if(config?.sourceGrant)config.sourceGrant={...config.sourceGrant,active:false,reason:'来源方案未启用或声明已变化，保留记录与消耗'};
 }
 rememberSourceSpellUses(c,undefined,true);return before!==fingerprint();
}

/** Save freely chosen explicit references; unresolved declarations never acquire guessed choices. */
export function setSourceSpellChoices(c:Character,key:string,refs:string[],catalog:Entry[]=[]):void{
 const choice=planSourceSpells(c,catalog).choices.find(x=>x.key===key&&x.spells);
 if(!choice||refs.length>choice.count!||new Set(refs).size!==refs.length||refs.some(ref=>!choice.spells!.includes(ref)))throw Error('赠送法术选择与当前声明不符。');
 const choices=c.automation!.spellChoices||={};Object.defineProperty(choices,key,{value:[...refs],enumerable:true,writable:true,configurable:true});
}
