import {createContext} from 'react';
import type {CloudSession} from './api';
import type {SyncState} from './sync';
export const CloudSaveContext=createContext<{states:Record<string,SyncState>;session?:CloudSession;refreshSession:()=>Promise<void>;request:(id:string)=>void;beforeLogin:(id:string)=>Promise<void>;disabled:boolean}|undefined>(undefined);
