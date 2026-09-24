import {pinEntry} from '../core/quickbar';
import type {Character,Entry} from '../core/model';
export function quickbarDrop(hit:Element|null,entry:Entry,edit:(f:(c:Character)=>void)=>void){
 const zone=hit?.closest<HTMLElement>('.quickbar-copy-zone');if(!zone)return;
 edit(d=>pinEntry(d,entry));
 return {resolve:()=>zone.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(entry.id)}"]`)||zone};
}
