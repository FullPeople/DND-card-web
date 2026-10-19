import type {Character} from '../core/model';
import type {CardSummary,CloudCard} from './api';
export type Preview={revision:number;character?:Character;error?:string};

/** One mounted account gallery owns its previews; no process-wide private cache. */
export function previewCache(read:(id:string)=>Promise<CloudCard>){
 const cache=new Map<string,Preview>(),pending=new Map<string,Promise<Preview>>();
 function load(row:CardSummary){
  const saved=cache.get(row.id);if(saved?.character&&saved.revision>=row.revision)return Promise.resolve(saved);
  const existing=pending.get(row.id);if(existing)return existing;
  const task=read(row.id).then(card=>{
   const next={revision:card.revision,character:card.character};
   if((cache.get(row.id)?.revision||0)<=next.revision)cache.set(row.id,next);
   return cache.get(row.id)!;
  }).finally(()=>{if(pending.get(row.id)===task)pending.delete(row.id);});
  pending.set(row.id,task);return task;
 }
 return {cache,load};
}

export function adjacentPreviews(cards:CardSummary[],index:number){
 return [-1,1].map(offset=>cards[(index+offset+cards.length)%cards.length]).filter((row,i,rows)=>row&&row.id!==cards[index]?.id&&rows.findIndex(other=>other?.id===row.id)===i);
}
