import {selectionAllowed,uid,type Character,type Entry,type Selection} from './model';
import {spellState} from './characterDetails';
import {availableClassSpells,spellUsesPreparation} from './spellcastingRules';
import {preparationBase} from './preparation';
import {assignClassSpell,classSpellGroups} from './spellWorkspace';
import {casterProfiles,spellOnCurrentClassList} from './spellcastingRules';
import {optionalClassSpellListAccess,optionalClassSpellListDecision} from './automation/optionalClassSpellLists';

export function spellLibrary(c:Character,entries:Entry[]=[]):Selection[]{
 const selected=c.selections.filter(s=>s.entry.kind==='spell'),known=new Set(selected.filter(s=>!c.spellSettings?.special?.[s.id]?.sourceGrant).map(s=>s.entry.id));
 return [...selected,...availableClassSpells(c,entries).filter(e=>!known.has(e.id)).map(entry=>({id:`spell-list:${entry.id}`,entry,quantity:1,level:1,equipped:false}))];
}

/** Copy just the selected full-list spell into durable state; do not persist the whole class list. */
export function prepareSpellEntry(c:Character,entry:Entry,preferredSlot?:number,ownerId?:string):string|undefined{
 const matching=casterProfiles(c).filter(p=>p.mode==='prepared'&&spellOnCurrentClassList(c,entry,p));
 if(ownerId&&!matching.some(p=>p.owner.id===ownerId))return undefined;
 if(!ownerId&&matching.length>1&&matching.some(profile=>optionalClassSpellListAccess(c,entry,profile.owner.id)))return undefined;
 if(!c.spellSettings?.modeOverride&&!matching.length&&casterProfiles(c).some(profile=>{const access=optionalClassSpellListDecision(c,entry,profile.owner.id);return access.scoped&&!access.baseOverlap;}))return undefined;
 const selected=ownerId?matching.find(profile=>profile.owner.id===ownerId):matching.length===1?matching[0]:undefined;
 if(selected&&optionalClassSpellListAccess(c,entry,selected.owner.id)&&(!Number.isSafeInteger(entry.raw.level)||entry.raw.level<1||entry.raw.level>selected.maxLevel))return undefined;
 const existing=c.selections.find(s=>s.entry.kind==='spell'&&s.entry.id===entry.id&&!c.spellSettings?.special?.[s.id]);
 // Do not persist the pre-insert projection unless this new explicit optional preparation succeeds.
 const access=ownerId&&selected?optionalClassSpellListDecision(c,entry,selected.owner.id):undefined,groups=!existing&&access?.scoped&&access.allowed&&!access.baseOverlap?classSpellGroups(c):undefined;
 const assign=(id:string)=>{const owner=ownerId||(matching.length===1?matching[0].owner.id:undefined);if(owner)assignClassSpell(c,id,owner,groups);return id;};
 if(existing){const effective=spellState(c);return setPreparedSpell(c,existing.id,true,preferredSlot)||effective.prepared.slice(0,effective.capacity).includes(existing.id)?assign(existing.id):undefined;}
 if(!selectionAllowed(c,entry)||!spellUsesPreparation(c,entry))return undefined;
 const row:Selection={id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false};
 c.selections.push(row);
 if(setPreparedSpell(c,row.id,true,preferredSlot))return assign(row.id);
 c.selections.pop();return undefined;
}

/** Keep learned selections in place; preparation stores references to those IDs. */
export function togglePreparedSpell(c:Character,id:string,preferredSlot?:number):boolean{
 return setPreparedSpell(c,id,!spellState(c).prepared.includes(id),preferredSlot);
}

/** Preparation moves references, never duplicates or deletes the learned spell. */
export function setPreparedSpell(c:Character,id:string,prepare:boolean,preferredSlot?:number):boolean{
 const row=c.selections.find(s=>s.id===id&&s.entry.kind==='spell');
 if(!row||!spellUsesPreparation(c,row.entry,row.id))return false;
 const effective=spellState(c);
 if(effective.mode!=='prepared')return false;
 const settings=c.spellSettings||=structuredClone(spellState(c));
 settings.mode=effective.mode;
 const known=new Set(c.selections.filter(s=>s.entry.kind==='spell'&&spellUsesPreparation(c,s.entry,s.id)).map(s=>s.id));
 const prepared=settings.prepared.map(id=>known.has(id)?id:'');
 const currentIndex=prepared.indexOf(id);
 if(!prepare){if(currentIndex<0)return false;settings.prepared=prepared.map(value=>value===id?'':value);return true;}
 const limit=effective.capacity;
 const replacement=preferredSlot!==undefined&&preferredSlot>=0&&preferredSlot<limit;
 if(prepare&&currentIndex<0&&prepared.slice(0,limit).filter(Boolean).length>=limit&&!replacement)return false;
 if(currentIndex>=0){
  preferredSlot??=currentIndex>=limit?Array.from({length:limit},(_,i)=>i).find(i=>!prepared[i]):undefined;
  if(preferredSlot===undefined||preferredSlot<0||preferredSlot>=limit||preferredSlot===currentIndex)return false;
  while(prepared.length<=preferredSlot)prepared.push('');
  [prepared[currentIndex],prepared[preferredSlot]]=[prepared[preferredSlot],prepared[currentIndex]];
  settings.prepared=prepared;return true;
 }
 const index=replacement?preferredSlot:
  Array.from({length:limit},(_,i)=>i).find(i=>!prepared[i]);
 if(index===undefined)return false;
 while(prepared.length<=index)prepared.push('');
 prepared[index]=id;settings.prepared=prepared;return true;
}
