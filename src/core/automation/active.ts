import {automationEnabled} from './state';
import {selectionAllowed,selectionEffectsAllowed,type Character,type Selection} from '../model';

/** A missing, disabled or cyclic parent never leaves a child rule active. */
export function activeSelections(c:Character):Selection[]{
 const rows=new Map(c.selections.map(row=>[row.id,row]));
 return c.selections.filter(row=>{
  let current:Selection|undefined=row;const seen=new Set<string>();
  while(current){
   if(seen.has(current.id)||!selectionAllowed(c,current.entry))return false;
   seen.add(current.id);if(!current.parentId)return true;
   current=rows.get(current.parentId);
  }
  return false;
 });
}

/** Saved effects follow source availability, not the new-selection edition filter. */
export function activeEffectSelections(c:Character,excluded:ReadonlySet<string>=new Set()):Selection[]{
 const rows=new Map(c.selections.map(row=>[row.id,row])),counts=new Map<string,number>();for(const row of c.selections)counts.set(row.id,(counts.get(row.id)||0)+1);
 return c.selections.filter(row=>{
  let current:Selection|undefined=row;const seen=new Set<string>();
  while(current){
   if(counts.get(current.id)!==1||excluded.has(current.id)||seen.has(current.id)||current.grantKey?.startsWith('choice:')&&!automationEnabled(c)||!selectionEffectsAllowed(c,current.entry))return false;
   seen.add(current.id);if(!current.parentId)return true;
   current=rows.get(current.parentId);
  }
  return false;
 });
}
