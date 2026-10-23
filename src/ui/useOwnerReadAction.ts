import {useLayoutEffect,useMemo,useRef} from 'react';

/** Forward only to the same owner's latest committed handler. Mutating callers
 * still use their original permission, persistence and conflict checks; this
 * relay grants no write access and cannot redirect an old card's event. */
export function useOwnerAction<Args extends unknown[]>(owner:string|undefined,action:(...args:Args)=>void):(...args:Args)=>void{
 const latest=useRef({owner,action});
 useLayoutEffect(()=>{latest.current={owner,action};});
 return useMemo(()=>(...args:Args)=>{if(latest.current.owner===owner)latest.current.action(...args);},[owner]);
}

export const useOwnerReadAction=useOwnerAction;
