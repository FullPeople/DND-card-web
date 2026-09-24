import {useSyncExternalStore} from 'react';
export type UndoAction={label:string;undo:()=>Promise<unknown>|void;redo:()=>Promise<unknown>|void};
const past:UndoAction[]=[],future:UndoAction[]=[],listeners=new Set<()=>void>();let busy=false,tick=0,generation=0;
const emit=()=>{tick++;listeners.forEach(fn=>fn());};
export function recordAction(action:UndoAction){generation++;past.push(action);if(past.length>80)past.shift();future.length=0;emit();}
export async function travelHistory(redo=false){
 if(busy)return;
 const from=redo?future:past,action=from.pop();if(!action)return;
 const position=from.length,pastPosition=past.length,started=generation;busy=true;emit();
 try{await(redo?action.redo():action.undo());if(redo)past.splice(Math.min(pastPosition,past.length),0,action);else if(started===generation)future.push(action);}
 catch(error){if(!redo||started===generation)from.splice(Math.min(position,from.length),0,action);window.dispatchEvent(new CustomEvent('workbench-error',{detail:error instanceof Error?error.message:String(error)}));}
 finally{busy=false;emit();}
}
export function useActionHistory(){useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>tick);return {undo:!!past.length&&!busy,redo:!!future.length&&!busy,busy};}
