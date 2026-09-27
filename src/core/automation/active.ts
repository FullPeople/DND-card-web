import {selectionAllowed,type Character,type Selection} from '../model';

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
