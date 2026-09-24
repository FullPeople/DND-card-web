import {useSyncExternalStore} from 'react';
export type ResourceValue={id?:string;name?:string;current:number;max:number;type?:string;icon?:string;automatic?:boolean;unlimited?:boolean;locked?:boolean};
const prefix='com.obr-suite/resources/edit-presets',listeners=new Set<()=>void>();let tick=0;
export function loadPresets(scope='player'):ResourceValue[]{try{const raw=localStorage.getItem(prefix+':'+scope)||(scope==='player'?localStorage.getItem(prefix):'[]');return JSON.parse(raw||'[]').filter((r:ResourceValue)=>r&&typeof r.name==='string'&&Number.isFinite(r.max));}catch{return [];}}
export function savePreset(value:ResourceValue,scope='player'){const rows=loadPresets(scope).filter(r=>r.name!==value.name);rows.push({...value,id:undefined,automatic:false});localStorage.setItem(prefix+':'+scope,JSON.stringify(rows));tick++;listeners.forEach(fn=>fn());}
export function removePreset(name:string,scope='player'){localStorage.setItem(prefix+':'+scope,JSON.stringify(loadPresets(scope).filter(r=>r.name!==name)));tick++;listeners.forEach(fn=>fn());}
export function usePresets(scope='player'){useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>tick);return loadPresets(scope);}
