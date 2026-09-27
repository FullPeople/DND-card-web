import {selectionAllowed,type Character,type Selection} from '../model';
import {automationEnabled} from './state';

export function sourceSpellEnabled(c:Character,id:string):boolean{
 const grant=c.spellSettings?.special?.[id]?.sourceGrant;if(!grant)return true;
 if(!automationEnabled(c)||!grant.active)return false;
 let row=c.selections.find(s=>s.id===id);const seen=new Set<string>();
 while(row){if(seen.has(row.id)||!selectionAllowed(c,row.entry))return false;seen.add(row.id);if(!row.parentId)return true;row=c.selections.find(s=>s.id===row!.parentId);}
 return false;
}

/** Generated feature IDs can change after leveling down/up; source paths stay stable. */
export function sourceOwnerIdentity(c:Character,row:Selection):string{
 const path:string[]=[],seen=new Set<string>();let current:Selection|undefined=row;
 while(current&&!seen.has(current.id)){
  seen.add(current.id);
  if(!current.parentId||!current.grantKey){path.unshift(current.id);break;}
  path.unshift(current.grantKey);current=c.selections.find(s=>s.id===current!.parentId);
 }
 return JSON.stringify(path);
}
export function rememberSourceSpellUses(c:Character,id?:string){
 for(const [selectionId,config] of Object.entries(c.spellSettings?.special||{})){
  if(id&&selectionId!==id||!config.sourceGrant?.usageKey||config.mode!=='uses')continue;
  const r=c.runtime.resources[`innate-spell:${selectionId}`];if(!r)continue;
  (c.runtime.sourceSpellSpent||={})[config.sourceGrant.usageKey]=Math.max(0,r.max-r.current);
 }
}
