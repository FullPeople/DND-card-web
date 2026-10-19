import {createElement,lazy,type ComponentType} from 'react';

/** Share readiness with the renderer, so a preloaded panel cannot suspend again. */
export function deferredComponent<P extends object>(load:()=>Promise<{default:ComponentType<P>}>){
 let ready:ComponentType<P>|undefined,pending:ReturnType<typeof load>|undefined;
 const preload=()=>{
  if(!pending)pending=load().then(module=>{ready=module.default;return module;},error=>{pending=undefined;throw error;});
  return pending;
 };
 const Deferred=lazy(preload);
 const Component=(props:P)=>ready?createElement(ready,props):createElement(Deferred,props);
 return {Component,preload};
}
