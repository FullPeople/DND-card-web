import {useSyncExternalStore} from 'react';
const scope=new URLSearchParams(typeof location==='undefined'?'':location.hash.slice(1)).has('suite')?'workbench':'local';
const key=`dnd-character-book-order:${scope}`;
let order:string[]=[];
try{const value=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(value))order=[...new Set(value.filter((v):v is string=>typeof v==='string'))];}catch{/* A damaged reading preference cannot remove characters. */}
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key!==key)return;try{const value=JSON.parse(event.newValue||'[]');if(Array.isArray(value)){order=[...new Set(value.filter((v):v is string=>typeof v==='string'))];emit();}}catch{}});
export function orderedCharacters<T extends {id:string}>(rows:T[],ids=order):T[]{const rank=new Map(ids.map((id,i)=>[id,i]));return [...rows].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));}
export function moveCharacter(rows:{id:string}[],id:string,offset:number){const ids=orderedCharacters(rows).map(row=>row.id),index=ids.indexOf(id),to=index+offset;if(index<0||to<0||to>=ids.length)return;ids.splice(index,1);ids.splice(to,0,id);order=ids;try{localStorage.setItem(key,JSON.stringify(ids));}catch{/* Keep this session's order if storage is unavailable. */}emit();}
export function useCharacterBookOrder<T extends {id:string}>(rows:T[]){const ids=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>order,()=>order);return orderedCharacters(rows,ids);}
