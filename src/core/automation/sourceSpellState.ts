import {itemAtWillGrantKey,itemAtWillSpell} from './itemAtWill';
import {ownedItemChargeResource} from './itemChargeDebits';
import {limitedSourceSpellOffer,limitedSourceUseOffers,ownedLimitedSourceResource} from './limitedSourceUses';
import {specialSpellResource} from '../spellResourceKeys';
import {selectionAllowed,type Character,type Selection} from '../model';
import {automationEnabled} from './state';

export function sourceSpellEnabled(c:Character,id:string):boolean{
 let row=c.selections.find(s=>s.id===id);if(!row)return false;
 const config=c.spellSettings?.special?.[id],grant=config?.sourceGrant;if(!grant&&!config?.manualSource)return true;
 if(grant&&(!automationEnabled(c)||!grant.active))return false;
 if(itemAtWillGrantKey(grant?.key)||itemAtWillGrantKey(row.grantKey))return !!itemAtWillSpell(c,id);
 if(grant?.usage==='limited')return limitedSourceSpellOffer(c,id)?.offer.eligible===true;
 const seen=new Set<string>();
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
 // Canonical invocation pools survive aliases and inactive learning trees. Their
 // owned key, not mutable cached spell metadata, is the expenditure identity.
 for(const [key,r] of Object.entries(c.runtime.resources)){if(ownedItemChargeResource(c,key))continue;const usageKey=r.sourceSpellGrant?.usageKey;if(!usageKey||key!==`source-spell-pool:${encodeURIComponent(usageKey)}`||r.max!==1||!Number.isSafeInteger(r.current)||r.current<0||r.current>1||r.unlimited||id&&specialSpellResource(id,c)!==key)continue;(c.runtime.sourceSpellSpent||={})[usageKey]=1-r.current;}
 for(const [selectionId,config] of Object.entries(c.spellSettings?.special||{})){
  if(id&&selectionId!==id||!config.sourceGrant?.usageKey||config.mode!=='uses'||(config.sourceGrant.usage==='invocation-pact'||config.sourceGrant.usage==='limited'))continue;
  const r=c.runtime.resources[specialSpellResource(selectionId,c)];if(!r||r.sourceSpellGrant||ownedLimitedSourceResource(c,specialSpellResource(selectionId,c))||ownedItemChargeResource(c,specialSpellResource(selectionId,c)))continue;
  const ledger=c.runtime.sourceSpellSpent||={};ledger[config.sourceGrant.usageKey]=Math.max(0,r.max-r.current,preserveOverflow&&r.current===0?ledger[config.sourceGrant.usageKey]||0:0);
 }
}

/** A shared counter remains visible while any of its owning grants is usable. */
export function sourceSpellResourceEnabled(c:Character,key:string):boolean{
 if(ownedLimitedSourceResource(c,key))return limitedSourceUseOffers(c).some(o=>o.key===key&&o.eligible);
 if(key.startsWith('source-spell-pool:'))return Object.keys(c.spellSettings?.special||{}).some(id=>specialSpellResource(id,c)===key&&sourceSpellEnabled(c,id));
 return !key.startsWith('innate-spell:')||specialSpellResource(key.slice(13),c)===key&&sourceSpellEnabled(c,key.slice(13));
}
