import type {Entry} from '../core/model';

// Bookmarks contain identities only. Rule text is resolved from today's authorized catalog.
export const LIBRARY_FAVORITES_KEY='dnd-library-favorites-v1';
export function favoriteIdentity(entry:Entry){return JSON.stringify([entry.id,entry.source,entry.packId,entry.edition,entry.kind]);}
export function readFavoriteIdentities(value:string|null):string[]{
 try{
  const parsed:unknown=JSON.parse(value||'[]');if(!Array.isArray(parsed))return [];
  return [...new Set(parsed.filter((key):key is string=>{
   if(typeof key!=='string'||key.length>8000)return false;
   try{const identity:unknown=JSON.parse(key);return Array.isArray(identity)&&identity.length===5&&identity.every(part=>typeof part==='string')&&identity[0].length>0;}catch{return false;}
  }))];
 }catch{return [];}
}
