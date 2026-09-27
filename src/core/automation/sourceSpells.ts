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
export interface SourceSpellChoice {ownerId:string;key:string;label:string;sets?:string[];abilities?:Ability[];usageModes?:boolean}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Interpret declared data, never rule prose. Unresolved choices and shapes are visible. */
export function planSourceSpells(c:Character,catalog:Entry[]=[]):{grants:SourceSpellPlan[];issues:Issue[];choices:SourceSpellChoice[]}{
 const grants:SourceSpellPlan[]=[],issues:Issue[]=[],choices:SourceSpellChoice[]=[];
 if(!supportedAutomation(c))return {grants,issues,choices};
 const active=new Set(activeSelections(c).map(s=>s.id)),classes=c.selections.filter(s=>s.entry.kind==='class'),total=Math.max(1,classes.reduce((sum,s)=>sum+s.level,0));
 // Saved snapshots win over a newly downloaded edition/revision of the same entry.
 const known=[...new Map([...c.selections.map(s=>s.entry),...catalog].map(e=>[e.id,e] as const).reverse()).values()].filter(e=>e.kind==='spell');
 for(const owner of c.selections.filter(s=>s.entry.kind!=='spell'&&s.entry.raw.additionalSpells!=null)){
  const issue=(path:string,message:string)=>{const id=`source-spell:${owner.id}:${path}:${message}`;if(!issues.some(i=>i.id===id))issues.push({id,selectionId:owner.id,severity:'warning',message:`${owner.entry.name}：${message}`});};
  if(owner.entry.kind==='item'){issue('item','物品赠送施法与充能尚未接入，请按原文记录。');continue;}
  const blocks=owner.entry.raw.additionalSpells;if(!Array.isArray(blocks)){issue('shape','额外法术数据格式未支持。');continue;}
  const selectedSet=blocks.length===1?0:c.automation?.spellSets?.[owner.id];
  if(blocks.length>1){choices.push({ownerId:owner.id,key:owner.id,label:owner.entry.name+'的施法方案',sets:blocks.map((b,i)=>b?.name||`方案 ${i+1}`)});if(selectedSet===undefined){issue('set','有多个施法方案，请选择一项；尚未自动赠送。');continue;}}
  if(!Number.isInteger(selectedSet)||!object(blocks[selectedSet!])){issue('set','已记录的施法方案无法匹配，请重新选择。');continue;}
  const index=selectedSet!,block=blocks[index],blockKey=`${owner.id}:${index}`;
  let cls=owner.entry.kind==='class'?owner:parentClass(c,owner),parent=owner;const seen=new Set<string>();
  while(!cls&&parent.parentId&&!seen.has(parent.id)){seen.add(parent.id);const next=c.selections.find(s=>s.id===parent.parentId);if(!next)break;parent=next;cls=parent.entry.kind==='class'?parent:parentClass(c,parent);}
  let ability:Ability|undefined=ABILITIES.includes(block.ability)?block.ability:undefined;
  if(object(block.ability)&&Array.isArray(block.ability.choose)){
   const options=block.ability.choose.filter((a:any)=>ABILITIES.includes(a)) as Ability[];choices.push({ownerId:owner.id,key:blockKey,label:owner.entry.name+'的施法属性',abilities:options});
   const chosen=c.automation?.spellAbilities?.[blockKey];if(chosen&&options.includes(chosen))ability=chosen;else issue('ability','请记录赠送法术的施法属性，暂不猜测攻击与 DC。');
  }else if(block.ability!==undefined&&!ability)issue('ability','施法属性表达式未支持，攻击与 DC 需人工核对。');
  if(block.ability===undefined&&cls){const profile=casterProfiles(c).find(p=>p.owner.id===cls!.id);const declared=profile?.casting.entry.raw.spellcastingAbility||cls.entry.raw.spellcastingAbility;if(ABILITIES.includes(declared))ability=declared;}
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
    function addList(list:unknown,path:string,usage:'slot'|'free'|'ritual'|'check',count?:number,recovery?:SpecialSpell['recovery'],shared=false){
     if(!Array.isArray(list)){issue(path,'赠送列表格式未支持。');return;}
     for(const ref of list){
      if(typeof ref!=='string'){issue(path,'有需要选择或筛选的法术，请先按原文手动选择；本轮只自动加入明确指定的法术。');continue;}
      const [uid,castLevel]=ref.split('#'),parts=uid.split('|'),reference=`${parts[0]}|${parts[1]||'PHB'}`;
      if(castLevel&&!/^(c|[1-9])$/.test(castLevel)){issue(path,'施法环阶后缀未支持。');continue;}
      const entries=known.filter(e=>matchesReference(e,reference));
      if(entries.length!==1){issue(path+':'+ref,entries.length?'法术引用存在多个身份，未自动任选一条。':`尚未找到 ${reference}，资料加载后再关联。`);continue;}
      const entry=entries[0];if(castLevel==='c'&&Number(entry.raw.level)!==0){issue(path+':'+ref,'声明的戏法与条目环阶不符。');continue;}
      const key=`source-spell:${index}/${kind}/${gate}/${path}/${ref.toLowerCase()}`,id=`auto-spell:${owner.id}:${encodeURIComponent(key)}`;
      const poolPath=`source-spell:${index}/${kind}/${gate}/${path}`,usageKey=JSON.stringify([sourceOwnerIdentity(c,owner),shared?poolPath:key]);
      const resourceKey=shared?`source-spell-pool:${encodeURIComponent(usageKey)}`:undefined;
      const enabled=automationEnabled(c)&&active.has(owner.id)&&eligible&&selectionAllowed(c,entry);
      const label=kind==='prepared'?'始终预备':count?'来源次数施法':usage==='free'?'随意施法':usage==='ritual'?'仅仪式':kind==='known'?'来源已知法术':'来源天生施法';
      const config:SpecialSpell={mode:count?'uses':'locked',...(count?{max:count,recovery}:{}),label,sourceGrant:{ownerId:owner.id,key,usageKey,resourceKey,canUseSlots:kind==='known'||kind==='prepared',ability,active:enabled,usage:usage==='slot'&&Number(entry.raw.level)===0?'free':usage,castLevel:castLevel&&castLevel!=='c'?Number(castLevel):undefined,reason:enabled?undefined:!automationEnabled(c)?'自动计算已关闭':!eligible?'尚未达到来源等级':'来源、版本或依赖未启用'}};
      grants.push({id,owner,key,entry,eligible,config});
     }
    }
    if(Array.isArray(value)){addList(value,'_',kind==='innate'?'check':'slot');continue;}
    if(!object(value)){issue(`${kind}/${gate}`,'赠送法术配置未支持。');continue;}
    for(const [schedule,spells] of Object.entries(value)){
     if(schedule==='_'||schedule==='will'||schedule==='ritual'){addList(spells,schedule,schedule==='will'?'free':schedule==='ritual'?'ritual':kind==='innate'?'check':'slot');continue;}
     if(!['daily','rest'].includes(schedule)||!object(spells)){issue(`${kind}/${gate}/${schedule}`,'充能、资源或次数机制尚未支持。');continue;}
     for(const [count,refs] of Object.entries(spells)){
      if(!/^[1-9]\d?e?$/.test(count)||!Array.isArray(refs)){issue(`${schedule}/${count}`,'次数公式未支持。');continue;}
      let shared=false;
      if(refs.length>1&&!count.endsWith('e')){
       const choiceKey=JSON.stringify([sourceOwnerIdentity(c,owner),`source-spell:${index}/${kind}/${gate}/${schedule}/${count}`]);
       choices.push({ownerId:owner.id,key:choiceKey,label:`${owner.entry.name}的次数归属：${refs.map(ref=>typeof ref==='string'?ref.split('|')[0]:'待选法术').join('、')}`,usageModes:true});
       const mode=c.automation?.spellUsageModes?.[choiceKey];
       if(!mode){issue(`${schedule}/${count}`,'多个法术的次数归属未明确，请核对原文后选择各自次数或共用次数。');continue;}
       shared=mode==='shared';
      }
      addList(refs,`${schedule}/${count}`,'free',Number(count.replace('e','')),schedule==='rest'?'short':'long',shared);
     }
    }
   }
  }
 }
 return {grants,issues,choices};
}

/** Reconcile explicit source grants. Resources initialize only when a grant first appears. */
export function syncSourceSpells(c:Character,catalog:Entry[]):boolean{
 if(!supportedAutomation(c))return false;
 const fingerprint=()=>JSON.stringify([c.selections.filter(s=>sourceSpellKey(s.grantKey)).map(s=>[s.id,c.spellSettings?.special?.[s.id],c.runtime.resources[specialSpellResource(s.id,c)]]),c.spellSettings?.prepared,c.runtime.sourceSpellSpent]);
 const before=fingerprint();rememberSourceSpellUses(c);const plan=planSourceSpells(c,catalog),matched=new Set<string>();
 const transfers=new Map<string,{max:number;old:Set<string>}>();
 for(const grant of plan.grants){const old=c.spellSettings?.special?.[grant.id];if(old?.mode!=='uses'||grant.config.mode!=='uses')continue;
  const previousKey=specialSpellResource(grant.id,c),nextKey=grant.config.sourceGrant?.resourceKey||`innate-spell:${grant.id}`;
  if(previousKey===nextKey)continue;const transfer=transfers.get(nextKey)||{max:grant.config.max!,old:new Set<string>()};transfer.old.add(previousKey);transfers.set(nextKey,transfer);
 }
 for(const [key,transfer] of transfers){const current=c.runtime.resources[key],spent=[...transfer.old].reduce((sum,k)=>{const r=c.runtime.resources[k];return sum+(r?Math.max(0,r.max-r.current):transfer.max);},0),preserved=Math.max(spent,current?Math.max(0,current.max-current.current):0);c.runtime.resources[key]={...current,max:transfer.max,current:Math.max(0,transfer.max-preserved),type:'count'};}

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
   else {resource.name||=grant.config.sourceGrant?.resourceKey?`${grant.owner.entry.name}共享施法次数`:`${row.entry.name} · ${grant.owner.entry.name}`;if(resource.max!==max){const spent=Math.max(0,resource.max-resource.current);resource.max=max;resource.current=Math.max(0,max-spent);}}
  }
 }
 for(const row of c.selections.filter(s=>sourceSpellKey(s.grantKey)&&!matched.has(s.id))){
  const config=c.spellSettings?.special?.[row.id];if(config?.sourceGrant)config.sourceGrant={...config.sourceGrant,active:false,reason:'来源方案未启用或声明已变化，保留记录与消耗'};
 }
 rememberSourceSpellUses(c);return before!==fingerprint();
}
