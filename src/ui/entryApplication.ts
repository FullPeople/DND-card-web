import {createContext} from 'react';
import type {Entry} from '../core/model';
export type EntryApplicationTarget={id:string;label:string;apply:()=>void};
export const EntryApplicationContext=createContext<((entry:Entry)=>EntryApplicationTarget[])|undefined>(undefined);
