import {createContext,useContext,type Context} from 'react';

export type SheetContextKey='drag'|'application'|'reference'|'choice'|'choices'|'feedback';
export type SheetContextScope=Record<SheetContextKey,Context<any>>;
export const SheetContextScope=createContext<SheetContextScope|undefined>(undefined);

/** Subscribe to the card-owned context identity, rather than the shared App
 * provider. Re-providing that same shared context still propagates its updates
 * through retained memo boundaries in React. Other surfaces keep the default. */
export function useSheetContext<T>(key:SheetContextKey,shared:Context<T>):T{
 const scope=useContext(SheetContextScope);
 return useContext((scope?.[key]||shared) as Context<T>);
}

/** Nested choice workspaces override the same card-owned context that their
 * children subscribe to; ordinary previews keep their existing provider. */
export function useSheetContextProvider<T>(key:SheetContextKey,shared:Context<T>){
 const scope=useContext(SheetContextScope);
 return ((scope?.[key]||shared) as Context<T>).Provider;
}
