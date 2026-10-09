import type {Character,Entry} from '../model';
import {rememberSourceSpellUses} from './sourceSpellState';
import {spellState} from '../characterDetails';
import {specialSpellResource} from '../spellResourceKeys';
import {supportedAutomation} from './state';
import {planSourceSpells,sourceSpellKey} from './sourceSpellPlan';
export {planSourceSpells,sourceSpellKey} from './sourceSpellPlan';
export type {SourceSpellPlan,SourceSpellChoice} from './sourceSpellPlan';

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

export function setSourceResourceColumn(c:Character,key:string,column:string,catalog:Entry[]=[]):void{
 const choice=planSourceSpells(c,catalog).choices.find(choice=>choice.key===key&&choice.resourceColumns);
 if(!choice||column&&!choice.resourceColumns!.some(option=>option.label===column))throw Error('所选资源列与当前职业声明不符。');
 const columns=c.automation!.spellResourceColumns||={};
 if(!column)delete columns[key];else Object.defineProperty(columns,key,{value:column,enumerable:true,writable:true,configurable:true});
}
