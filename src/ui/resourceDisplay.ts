import {createContext} from 'react';
/** Read-only projection of ResourceRow's existing optimistic/ACK state. */
export const ResourceDisplayContext=createContext<((value:number)=>void)|undefined>(undefined);
