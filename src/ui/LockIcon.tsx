import {LockClosedIcon,LockOpenIcon} from './icons';
export function LockIcon({locked}:{locked:boolean}){return locked?<LockClosedIcon data-locked="true" size={15}/>:<LockOpenIcon data-locked="false" size={15}/>;}
