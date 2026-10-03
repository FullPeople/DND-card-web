import {useSyncExternalStore} from 'react';

export const STARTUP_EVENT='dnd-card-startup';
export type StartupPhase='loading'|'playing'|'waiting'|'fading'|'complete'|'failed'|'cancelled';
/** The inline shell owns this snapshot before any asynchronous app code runs. */
export function startupPhase():StartupPhase {
 if(typeof document==='undefined'||!document.documentElement)return 'complete';
 return (document.documentElement.dataset.cardStartup as StartupPhase|undefined)
  ??(document.getElementById('startup-intro')?'loading':'complete');
}
export function subscribeStartup(listener:()=>void){window.addEventListener(STARTUP_EVENT,listener);return()=>window.removeEventListener(STARTUP_EVENT,listener);}
export function useStartupComplete(){return useSyncExternalStore(subscribeStartup,()=>startupPhase()==='complete',()=>false);}

/** Decorative assets may resume after recovery without opening pending notices. */
export function useStartupSettled(){return useSyncExternalStore(subscribeStartup,()=>['complete','failed'].includes(startupPhase()),()=>false);}
