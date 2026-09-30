import {selectionAllowed,uid,type Character,type Entry,type Selection} from './model';
import {spellState} from './characterDetails';
import {availableClassSpells,spellUsesPreparation} from './spellcastingRules';

export function spellLibrary(c:Character,entries:Entry[]=[]):Selection[]{
 const selected=c.selections.filter(s=>s.entry.kind==='spell'),known=new Set(selected.filter(s=>!c.spellSettings?.special?.[s.id]?.sourceGrant).map(s=>s.entry.id));
 return [...selected,...availableClassSpells(c,entries).filter(e=>!known.has(e.id)).map(entry=>({id:`spell-list:${entry.id}`,entry,quantity:1,level:1,equipped:false}))];
}

/** Copy just the selected full-list spell into durable state; do not persist the whole class list. */
export function prepareSpellEntry(c:Character,entry:Entry,preferredSlot?:number):string|undefined{
 const existing=c.selections.find(s=>s.entry.kind==='spell'&&s.entry.id===entry.id&&!c.spellSettings?.special?.[s.id]);
 if(existing){const effective=spellState(c);return setPreparedSpell(c,existing.id,true,preferredSlot)||effective.prepared.slice(0,effective.capacity).includes(existing.id)?existing.id:undefined;}
 if(!selectionAllowed(c,entry)||!spellUsesPreparation(c,entry))return undefined;
 const row:Selection={id:uid(),entry:structuredClone(entry),quantity:1,level:1,equipped:false};
 c.selections.push(row);
 if(setPreparedSpell(c,row.id,true,preferredSlot))return row.id;
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
