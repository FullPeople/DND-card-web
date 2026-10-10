import {useContext} from 'react';
import {CloudSaveContext} from './CloudSaveContext';
import {CloudIcon} from '../ui/CloudIcon';
export function CloudSaveBadge({id}:{id:string}){const context=useContext(CloudSaveContext);return context?.states[id]?.cloudId?<CloudIcon/>:null;}
