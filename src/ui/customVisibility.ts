import {useState} from 'react';
import type {Entry} from '../core/model';
export type CustomVisibility='all'|'native'|'custom';
export const CUSTOM_VISIBILITY_LABELS={all:'目前全部',native:'目前仅非自定义',custom:'目前仅自定义'};
export const isCustomEntry=(entry:Entry)=>entry.raw._customPack===true||entry.raw._custom===true||entry.raw._workbenchCustom===true||entry.packId==='custom'&&entry.source==='CUSTOM';
export const customVisibilityAllows=(entry:Entry,mode:CustomVisibility)=>mode==='all'||isCustomEntry(entry)===(mode==='custom');
export function useCustomVisibility(){
 const [mode,setMode]=useState<CustomVisibility>(()=>{try{const value=localStorage.getItem('dnd-library-custom-visibility');return value==='native'||value==='custom'?value:'all';}catch{return 'all';}});
 function change(next:CustomVisibility){setMode(next);try{localStorage.setItem('dnd-library-custom-visibility',next);}catch{/* A reading preference cannot block local editing. */}}
 return {mode,change,cycle:()=>change(mode==='all'?'native':mode==='native'?'custom':'all')};
}
