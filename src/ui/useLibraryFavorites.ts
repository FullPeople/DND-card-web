import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Entry} from '../core/model';
import {LIBRARY_FAVORITES_KEY,favoriteIdentity,readFavoriteIdentities} from './libraryFavorites';

function read(){try{return readFavoriteIdentities(localStorage.getItem(LIBRARY_FAVORITES_KEY));}catch{return [];}}
export function useLibraryFavorites(){
 const [identities,setIdentities]=useState(read);
 const keys=useMemo(()=>new Set(identities),[identities]);
 useEffect(()=>{
  const receive=(event:StorageEvent)=>{if(event.storageArea===localStorage&&(event.key===LIBRARY_FAVORITES_KEY||event.key===null))setIdentities(read());};
  window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
 },[]);
 const has=useCallback((entry:Entry)=>keys.has(favoriteIdentity(entry)),[keys]);
 const change=useCallback((entry:Entry,add:boolean)=>{
  const current=new Set(read()),key=favoriteIdentity(entry);if(add)current.add(key);else current.delete(key);
  const next=[...current];
  // Do not claim persistence if the browser refuses the write.
  localStorage.setItem(LIBRARY_FAVORITES_KEY,JSON.stringify(next));setIdentities(next);
 },[]);
 return {has,change};
}
