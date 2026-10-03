import {useEffect,useRef} from 'react';

export type ResourceDraftScope='dashboard'|'resource-form'|'new-module';
export type ResourceDraftState={scope:ResourceDraftScope;dirty:boolean;busy:boolean};
const guards=new Set<{current:ResourceDraftState}>();
/** One confirmation for all nested drafts. A cancelled close never clears state. */
export function confirmResourceDraftDiscard(scope?:ResourceDraftScope){
 const active=[...guards].map(ref=>ref.current).filter(guard=>!scope||guard.scope===scope);
 return canDiscardResourceDrafts(active,message=>window.confirm(message));
}
export function canDiscardResourceDrafts(active:readonly ResourceDraftState[],confirm:(message:string)=>boolean){
 if(active.some(guard=>guard.busy))return false;
 return !active.some(guard=>guard.dirty)||confirm('仪表盘有未保存的修改。确定放弃这些修改并离开吗？');
}
export function useResourceDraftGuard(scope:ResourceDraftScope,dirty:boolean,busy=false){
 const current=useRef<ResourceDraftState>({scope,dirty,busy});current.current={scope,dirty,busy};
 useEffect(()=>{guards.add(current);const unload=(event:BeforeUnloadEvent)=>{if(current.current.dirty||current.current.busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',unload);return()=>{guards.delete(current);window.removeEventListener('beforeunload',unload);};},[]);
 // A successful save can synchronously clear the guard before a close callback.
 return current;
}
