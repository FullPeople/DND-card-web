import {useContext} from 'react';
import {CloudSaveContext} from './CloudSaveContext';
import {CloudIcon} from '../ui/CloudIcon';
export function CloudSaveBadge({id}:{id:string}){const context=useContext(CloudSaveContext),state=context?.states[id];return state?.cloudId?<CloudIcon data-cloud-phase={state.phase} data-cloud-save-ms={state.phase==='saved'?context?.syncMs?.(id)?.toFixed(2):undefined}/>:null;}
