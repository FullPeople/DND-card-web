import type {Entry} from '../core/model';
import {trainingCategory} from '../core/training';

export type EntryDragIntent = 'entry' | 'training';
/** Equipment can describe either a possession or a proficiency. Preserve the
 * source's intent for the whole gesture without rewriting the catalog entry. */
export function entryDragIntent(entry:Entry,source:{libraryTab?:string;trainingSource?:boolean}={}):EntryDragIntent{
  return trainingCategory(entry)&&(entry.kind!=='item'||source.libraryTab==='weaponProperty'||source.trainingSource)?'training':'entry';
}
export function entryDragPage(entry:Entry,intent:EntryDragIntent,preservePage=false){
  if(preservePage)return;
  return intent==='training'?'主要':entry.kind==='spell'?'法术':entry.kind==='item'?'背包':undefined;
}
