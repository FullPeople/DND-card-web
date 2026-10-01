import {specialSpellResource} from '../spellResourceKeys';
import {selectionAllowed,type Character,type Selection} from '../model';
import {automationEnabled} from './state';

export function sourceSpellEnabled(c:Character,id:string):boolean{
 const config=c.spellSettings?.special?.[id],grant=config?.sourceGrant;if(!grant&&!config?.manualSource)return true;
 if(grant&&(!automationEnabled(c)||!grant.active))return false;
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
// A zero counter may hide spent uses above a lowered maximum; only an explicit positive restoration clears that debt.
export function rememberSourceSpellUses(c:Character,id?:string,preserveOverflow=true){
 for(const [selectionId,config] of Object.entries(c.spellSettings?.special||{})){
  if(id&&selectionId!==id||!config.sourceGrant?.usageKey||config.mode!=='uses')continue;
  const r=c.runtime.resources[specialSpellResource(selectionId,c)];if(!r)continue;
  const ledger=c.runtime.sourceSpellSpent||={};ledger[config.sourceGrant.usageKey]=Math.max(0,r.max-r.current,preserveOverflow&&r.current===0?ledger[config.sourceGrant.usageKey]||0:0);
 }
}

/** A shared counter remains visible while any of its owning grants is usable. */
export function sourceSpellResourceEnabled(c:Character,key:string):boolean{
 if(key.startsWith('source-spell-pool:'))return Object.keys(c.spellSettings?.special||{}).some(id=>specialSpellResource(id,c)===key&&sourceSpellEnabled(c,id));
 return !key.startsWith('innate-spell:')||specialSpellResource(key.slice(13),c)===key&&sourceSpellEnabled(c,key.slice(13));
}
