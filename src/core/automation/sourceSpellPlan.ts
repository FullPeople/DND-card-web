import {itemAtWillOffers,itemAtWillRule,itemAtWillIdentity,itemAtWillTarget,itemAtWillStateIssue,itemAtWillChildCollision,itemAtWillChildKey,itemAtWillChildId} from './itemAtWill';
import {itemChargeOffers,itemChargeStateIssue} from './itemChargeDebits';
import {itemChargeIdentity,itemChargeRule} from './itemChargeDebitSource';
import {limitedSourceUseOffers,limitedSourceUseStateIssue} from './limitedSourceUses';
import {limitedSourceIdentity,limitedSourceRule,limitedSourcePoolId} from './limitedSourceUseSource';
import {reviewedAlertIdentity} from './reviewedFeatIdentity';
import {evaluate} from '../engine';
import {learnedInvocationRule,invocationSpellMatches,invocationCandidate} from './invocations';
import {sourceOwnerIdentity} from './sourceSpellState';
import {ABILITIES,selectionAllowed,type Ability,type Character,type Entry,type Issue,type Selection,type SpecialSpell} from '../model';
import {matchesReference} from '../entryReferences';
import {parentClass} from '../featureOwnership';
import {casterProfiles} from '../spellcastingRules';
import {activeSelections} from './active';
import {automationEnabled,supportedAutomation} from './state';
import {planFeatureResources} from './featureResources';
import {sourceResourcePool,validResourceCost,type ResourceColumn} from './sourceResourcePools';

export const sourceSpellKey=(key?:string)=>!!key?.startsWith('source-spell:');
export interface SourceSpellPlan {id:string;owner:Selection;key:string;entry:Entry;eligible:boolean;config:SpecialSpell}
export interface SourceSpellChoice {ownerId:string;key:string;label:string;sets?:string[];abilities?:Ability[];usageModes?:boolean;spells?:string[];count?:number;resourceColumns?:ResourceColumn[];limitedUse?:{ownerId:string;poolId:string};itemChargeUse?:{ownerId:string};itemAtWill?:{ownerId:string}}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Interpret declared data, never rule prose. Unresolved choices and shapes are visible. */
export function planSourceSpells(c:Character,catalog:Entry[]=[]):{grants:SourceSpellPlan[];issues:Issue[];choices:SourceSpellChoice[]}{
 const grants:SourceSpellPlan[]=[],issues:Issue[]=[],choices:SourceSpellChoice[]=[];
 let resourceGrants:ReturnType<typeof planFeatureResources>['grants']|undefined;
 const itemIssue=itemChargeStateIssue(c);if(itemIssue)issues.push({id:'item-charge-history',severity:'warning',message:itemIssue});
 const limitedIssue=limitedSourceUseStateIssue(c);if(limitedIssue)issues.push({id:'limited-source-history',severity:'warning',message:limitedIssue});
 if(!supportedAutomation(c))return {grants,issues,choices};
 const active=new Set(activeSelections(c).map(s=>s.id)),classes=c.selections.filter(s=>s.entry.kind==='class'&&!reviewedAlertIdentity(s.entry)&&!limitedSourceIdentity(s.entry)&&!itemChargeIdentity(s.entry)),total=Math.max(1,classes.reduce((sum,s)=>sum+s.level,0));
 // Saved snapshots win over a newly downloaded edition/revision of the same entry.
 const known=[...new Map([...c.selections.map(s=>s.entry),...catalog].map(e=>[e.id,e] as const).reverse()).values()].filter(e=>e.kind==='spell');
 for(const owner of c.selections.filter(s=>s.entry.kind!=='spell'&&s.entry.raw.additionalSpells!=null)){
  // Alert's authenticated PHB adapter grants only initiative; edited family
  // copies cannot bypass it through generic additionalSpells or use pools.
  // The genuine XPHB compatibility exception retains its original route.
  if(reviewedAlertIdentity(owner.entry)||itemAtWillIdentity(owner.entry))continue;
  const limitedRule=limitedSourceRule(owner.entry);
  const issue=(path:string,message:string)=>{const id=`source-spell:${owner.id}:${path}:${message}`;if(!issues.some(i=>i.id===id))issues.push({id,selectionId:owner.id,severity:'warning',message:`${owner.entry.name}：${message}`});};
  if(limitedSourceIdentity(owner.entry)&&!limitedRule){issue('limited-proof','有限来源身份或完整快照未通过核验，保留手工记录。');continue;}
  if(itemChargeIdentity(owner.entry)&&!itemChargeRule(owner.entry)){issue('item-charge-proof','物品完整来源快照未通过核验，保留手工记录。');continue;}
  if(owner.entry.kind==='item'){issue('item',itemChargeRule(owner.entry)?.supported?'仅提供一个来源证明的固定费用记账；物品施法、效果与恢复仍需人工处理。':'物品赠送施法与充能尚未接入，请按原文记录。');continue;}
  const reviewedInvocation=learnedInvocationRule(c,owner);
  const unreviewedInvocation=invocationCandidate(owner.entry)&&!reviewedInvocation;
  if(unreviewedInvocation)issue('invocation-owner','祈唤尚未通过当前职业学习授权或声明已变化；保留记录，不自动授予施法。');
  const blocks=owner.entry.raw.additionalSpells;if(!Array.isArray(blocks)){issue('shape','额外法术数据格式未支持。');continue;}
  const selectedSet=blocks.length===1?0:c.automation?.spellSets?.[owner.id];
  if(blocks.length>1){choices.push({ownerId:owner.id,key:owner.id,label:owner.entry.name+'的施法方案',sets:blocks.map((b,i)=>b?.name||`方案 ${i+1}`)});if(selectedSet===undefined){issue('set','有多个施法方案，请选择一项；尚未自动赠送。');continue;}}
  if(!Number.isInteger(selectedSet)||!object(blocks[selectedSet!])){issue('set','已记录的施法方案无法匹配，请重新选择。');continue;}
  const index=selectedSet!,block=blocks[index],blockKey=`${owner.id}:${index}`;
  let cls=owner.entry.kind==='class'?owner:parentClass(c,owner),parent=owner;const seen=new Set<string>();
  while(!cls&&parent.parentId&&!seen.has(parent.id)){seen.add(parent.id);const next=c.selections.find(s=>s.id===parent.parentId);if(!next)break;parent=next;cls=parent.entry.kind==='class'?parent:parentClass(c,parent);}
  // Implicit raw class metadata is not permission to borrow a forged Alert's
  // level. Other real-class metadata resolution retains its existing route.
  if(cls&&(reviewedAlertIdentity(cls.entry)||limitedSourceIdentity(cls.entry)||itemChargeIdentity(cls.entry)))continue;
  let ability:Ability|undefined=ABILITIES.includes(block.ability)?block.ability:undefined;
  if(object(block.ability)&&Array.isArray(block.ability.choose)){
   const options=block.ability.choose.filter((a:any)=>ABILITIES.includes(a)) as Ability[];choices.push({ownerId:owner.id,key:blockKey,label:owner.entry.name+'的施法属性',abilities:options});
   const chosen=c.automation?.spellAbilities?.[blockKey];if(chosen&&options.includes(chosen))ability=chosen;else issue('ability','请记录赠送法术的施法属性，暂不猜测攻击与 DC。');
  }else if(block.ability!==undefined&&!ability)issue('ability','施法属性表达式未支持，攻击与 DC 需人工核对。');
  if(block.ability===undefined&&cls&&!limitedRule){const profile=casterProfiles(c).find(p=>p.owner.id===cls!.id);const declared=profile?.casting.entry.raw.spellcastingAbility||cls.entry.raw.spellcastingAbility;if(ABILITIES.includes(declared))ability=declared;}
  for(const unknown of Object.keys(block).filter(k=>!['name','ENG_name','ability','known','prepared','innate','expanded','resourceName'].includes(k)))issue(unknown,`${unknown} 条件尚未支持，该方案暂不自动应用。`);
  if(Object.keys(block).some(k=>!['name','ENG_name','ability','known','prepared','innate','expanded','resourceName'].includes(k)))continue;
  for(const kind of ['known','prepared','innate','expanded'] as const){
   const levels=block[kind];if(levels==null)continue;if(!object(levels)){issue(kind,'法术等级条件格式未支持。');continue;}
   if(kind==='expanded'){issue('expanded','扩展法表仅代表可选范围，不会自动赠送；当前请从 Wiki 手动加入。');continue;}
   for(const [gate,value] of Object.entries(levels)){
    let eligible=false;const current=cls?.level||total;
    if(gate==='_')eligible=true;else if(/^\d+$/.test(gate))eligible=current>=Number(gate);
    else if(/^s[1-9]$/.test(gate)){const profiles=casterProfiles(c).filter(p=>!cls||p.owner.id===cls.id);eligible=profiles.some(p=>p.maxLevel>=Number(gate.slice(1)));}
    else {issue(`${kind}/${gate}`,'等级门槛尚未支持，未自动赠送。');continue;}
    function resolveList(list:unknown,path:string):string[]{
     if(!Array.isArray(list)){issue(path,'赠送列表格式未支持。');return [];}
     return list.flatMap((ref,node)=>{
      if(typeof ref==='string')return [ref];
      const from=ref?.choose?.from,count=ref?.choose?.count??1;
      if(!object(ref)||Object.keys(ref).some(k=>k!=='choose')||!object(ref.choose)||Object.keys(ref.choose).some(k=>!['from','count'].includes(k))||!Array.isArray(from)||from.length<2||from.some(x=>typeof x!=='string')||new Set(from).size!==from.length||!Number.isInteger(count)||count<1||count>Math.min(100,from.length)){
       issue(path,'有需要选择或筛选的法术；当前仅支持明确 UID 的 choose.from 列表，其他条件请按原文手动选择。');return [];
      }
      const key=JSON.stringify([sourceOwnerIdentity(c,owner),`source-spell:${index}/${kind}/${gate}/${path}/choose:${node}`]);
      choices.push({ownerId:owner.id,key,label:owner.entry.name+'的赠送法术',spells:from,count});
      const selected=c.automation?.spellChoices?.[key]||[];
      if(selected.length>count||new Set(selected).size!==selected.length||selected.some(uid=>!from.includes(uid))){issue(path,'已保存的赠送法术选择与当前声明不符，请重新选择；记录保留。');return [];}
      if(selected.length<count)issue(path,`可记录 ${count} 项赠送法术，尚有 ${count-selected.length} 项未选。`);
      return selected;
     });
    }
    function addList(list:unknown,path:string,usage:NonNullable<SpecialSpell['sourceGrant']>['usage'],count?:number,recovery?:SpecialSpell['recovery'],shared=false,resource?:{name:string;cost:number;key:string}){
     if(!Array.isArray(list)){issue(path,'赠送列表格式未支持。');return;}
     if(unreviewedInvocation){usage='check';count=undefined;recovery=undefined;resource=undefined;shared=false;}
     for(const ref of resolveList(list,path)){
      const [uid,castLevel]=ref.split('#'),parts=uid.split('|'),reference=`${parts[0]}|${parts[1]||'PHB'}`;
      if(castLevel&&!/^(c|[1-9])$/.test(castLevel)){issue(path,'施法环阶后缀未支持。');continue;}
      const invocationSpell=(usage==='free'||usage==='invocation-pact')&&reviewedInvocation?.mechanism==='spell'?reviewedInvocation:undefined;
      const entries=known.filter(e=>invocationSpell?invocationSpellMatches(e,invocationSpell):matchesReference(e,reference));
      if(entries.length!==1){issue(path+':'+ref,entries.length?'法术引用存在多个身份，未自动任选一条。':`尚未找到 ${reference}，资料加载后再关联。`);continue;}
      const entry=entries[0];
      if(castLevel==='c'&&Number(entry.raw.level)!==0){issue(path+':'+ref,'声明的戏法与条目环阶不符。');continue;}
      const limited=usage==='limited'?limitedRule?.pools.find(p=>p.block===index&&p.mode===kind&&p.gate===gate&&p.path===path&&p.reference===ref):undefined;
      const limitedOffer=limited&&limitedSourceUseOffers(c).find(o=>o.ownerId===owner.id&&o.poolId===limitedSourcePoolId(limitedRule!,limited));
      if(usage==='limited'&&(!limited||!limitedOffer?.record))continue;
      const key=`source-spell:${index}/${kind}/${gate}/${path}/${ref.toLowerCase()}`,id=`auto-spell:${owner.id}:${encodeURIComponent(key)}`;
      const poolPath=`source-spell:${index}/${kind}/${gate}/${path}`,usageKey=limitedOffer?.key||(usage==='invocation-pact'?JSON.stringify(['invocation-pact',cls!.id,reviewedInvocation!.reference]):JSON.stringify([sourceOwnerIdentity(c,owner),shared?poolPath:key]));
      const resourceKey=limitedOffer?.key||resource?.key||(shared||usage==='invocation-pact'?`source-spell-pool:${encodeURIComponent(usageKey)}`:undefined);
      const enabled=automationEnabled(c)&&active.has(owner.id)&&eligible&&selectionAllowed(c,entry)&&(!limited||limitedOffer?.eligible===true);
      const label=limited?'有限次数（不恢复）':usage==='invocation-pact'?'祈唤次数＋魔契师契约位':resource?'来源资源施法':kind==='prepared'?'始终预备':count?'来源次数施法':usage==='free'?'随意施法':usage==='ritual'?'仅仪式':kind==='known'?'来源已知法术':'来源天生施法';
      const config:SpecialSpell={mode:count?'uses':'locked',...(count?{max:count,recovery}:{}),label,sourceGrant:{ownerId:owner.id,key,usageKey,resourceKey,...(resource?{resourceName:resource.name,resourceCost:resource.cost}:{}),canUseSlots:!limited&&!unreviewedInvocation&&!resource&&(kind==='known'||kind==='prepared'),ability:limited?limitedRule?.ability as Ability|undefined:ability,active:enabled,usage:usage==='slot'&&Number(entry.raw.level)===0?'free':usage,castLevel:limited?limited.castLevel:castLevel&&castLevel!=='c'?Number(castLevel):undefined,reason:enabled?undefined:!automationEnabled(c)?'自动计算已关闭':!eligible?'尚未达到来源等级':'来源、版本或依赖未启用'}};
      grants.push({id,owner,key,entry,eligible,config});
     }
    }
    if(Array.isArray(value)){const reviewed=kind==='innate'&&gate==='_'&&index===0&&reviewedInvocation?.mechanism==='spell';if(reviewed)issue('invocation-boundary',reviewedInvocation!.boundary);addList(value,'_',kind==='innate'?(reviewed?'free':'check'):'slot');continue;}
    if(!object(value)){issue(`${kind}/${gate}`,'赠送法术配置未支持。');continue;}
    for(const [schedule,spells] of Object.entries(value)){
     if(schedule==='_'||schedule==='will'||schedule==='ritual'){addList(spells,schedule,schedule==='will'?'free':schedule==='ritual'?'ritual':kind==='innate'?'check':'slot');continue;}
     if(schedule==='limited'){
      const pools=limitedRule?.supported?limitedRule.pools.filter(p=>p.block===index&&p.mode===kind&&p.gate===gate):[];
      if(!pools.length){issue('limited-held','此有限次数来源、条件或共享消耗尚未受审；不会按每日或休息次数处理。');continue;}
      for(const pool of pools){const poolId=limitedSourcePoolId(limitedRule!,pool);if(!choices.some(q=>q.limitedUse?.ownerId===owner.id&&q.limitedUse.poolId===poolId))choices.push({ownerId:owner.id,key:JSON.stringify(['limited-source',owner.id,poolId]),label:owner.entry.name+'的有限次数',limitedUse:{ownerId:owner.id,poolId}});addList([pool.reference],pool.path,'limited',pool.capacity,'manual');}
      continue;
     }
     if(schedule==='resource'){
      if(typeof block.resourceName!=='string'||!block.resourceName.trim()||block.resourceName.length>160||!object(spells)){issue(`${kind}/${gate}/resource`,'资源名称或消耗声明未支持，请人工核对。');continue;}
      const costs=Object.entries(spells).filter(([cost,refs])=>validResourceCost(cost)&&Array.isArray(refs));
      for(const [cost,refs] of Object.entries(spells))if(!validResourceCost(cost)||!Array.isArray(refs))issue(`resource/${cost}`,'资源消耗需要明确的正整数，未自动施法。');
      if(!costs.length)continue;
      const binding=sourceResourcePool(c,owner,index,block.resourceName,resourceGrants??=planFeatureResources(c).grants);
      if(binding.columns.length&&(binding.reason||c.automation?.spellResourceColumns?.[binding.key]!==undefined)&&!choices.some(choice=>choice.key===binding.key))choices.push({ownerId:owner.id,key:binding.key,label:`${owner.entry.name}的${block.resourceName}资源`,resourceColumns:binding.columns});
      if(!binding.grant){issue(`${kind}/${gate}/resource`,binding.reason!);continue;}
      for(const [cost,refs] of costs){
       addList(refs,`resource/${cost}`,'resource',undefined,undefined,false,{name:block.resourceName,cost:Number(cost),key:binding.grant.key});
      }
      continue;
     }
     if(!['daily','rest'].includes(schedule)||!object(spells)){issue(`${kind}/${gate}/${schedule}`,'充能、资源或次数机制尚未支持。');continue;}
     for(const [count,refs] of Object.entries(spells)){
      if(!(/^[1-9]\d?e?$/.test(count)||count==='pb'||count==='pbe')||!Array.isArray(refs)){issue(`${schedule}/${count}`,'次数公式未支持。');continue;}
      const maximum=count==='pb'||count==='pbe'?evaluate(c).proficiency:Number(count.replace('e',''));
      if(!Number.isSafeInteger(maximum)||maximum<1||maximum>100){issue(`${schedule}/${count}`,'次数计算超出支持范围，请人工核对。');continue;}
      let shared=false;
      if(refs.reduce((sum,ref)=>sum+(typeof ref==='string'?1:Math.max(1,Number(ref?.choose?.count)||1)),0)>1&&!count.endsWith('e')){
       const choiceKey=JSON.stringify([sourceOwnerIdentity(c,owner),`source-spell:${index}/${kind}/${gate}/${schedule}/${count}`]);
       choices.push({ownerId:owner.id,key:choiceKey,label:`${owner.entry.name}的次数归属：${refs.map(ref=>typeof ref==='string'?ref.split('|')[0]:'待选法术').join('、')}`,usageModes:true});
       const mode=c.automation?.spellUsageModes?.[choiceKey];
       if(!mode){issue(`${schedule}/${count}`,'多个法术的次数归属未明确，请核对原文后选择各自次数或共用次数。');continue;}
       shared=mode==='shared';
      }
      const dual=reviewedInvocation?.payment==='pact-and-use';
      if(dual)issue('invocation-boundary',reviewedInvocation.boundary);
      addList(refs,`${schedule}/${count}`,dual?'invocation-pact':'free',maximum,schedule==='rest'?'short':'long',shared);
     }
    }
   }
  }
 }
 const itemAtWillIssue=itemAtWillStateIssue(c);if(itemAtWillIssue)issues.push({id:'item-atwill-history',severity:'warning',message:itemAtWillIssue});
 for(const offer of itemAtWillOffers(c,catalog)){
  choices.push({ownerId:offer.ownerId,key:offer.key,label:offer.label+'的物品随意施法',itemAtWill:{ownerId:offer.ownerId}});
  const owner=c.selections.find(s=>s.id===offer.ownerId),rule=owner&&itemAtWillRule(owner.entry);if(!owner||!rule||!offer.record)continue;
  for(const branch of offer.grants){if(itemAtWillChildCollision(c,owner.id,branch))continue;const entry=itemAtWillTarget(c,rule,branch,catalog);if(!entry)continue;const key=itemAtWillChildKey(branch),id=itemAtWillChildId(owner.id,branch);
   grants.push({id,owner,key,entry,eligible:offer.active,config:{mode:'locked',label:branch.targetScope==='self'?'物品随意施法（仅自身）':'物品随意施法',sourceGrant:{ownerId:owner.id,key,active:offer.active,usage:'free',canUseSlots:false,targetScope:branch.targetScope,targetEntryId:branch.targetEntryId,sourceActionTiming:branch.sourceActionTiming,reason:offer.active?undefined:offer.reason}}});
  }
 }
 for(const offer of limitedSourceUseOffers(c))if(!choices.some(q=>q.limitedUse?.ownerId===offer.ownerId&&q.limitedUse.poolId===offer.poolId))choices.push({ownerId:offer.ownerId,key:JSON.stringify(['limited-source',offer.ownerId,offer.poolId]),label:offer.ownerName+'的有限次数记录',limitedUse:{ownerId:offer.ownerId,poolId:offer.poolId}});
 for(const offer of itemChargeOffers(c))choices.push({ownerId:offer.ownerId,key:JSON.stringify(['item-charge',offer.ownerId]),label:offer.ownerName+'的充能记账',itemChargeUse:{ownerId:offer.ownerId}});
 return {grants,issues,choices};
}

