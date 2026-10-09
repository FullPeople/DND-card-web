import type {Character,Entry} from '../core/model';
import {trainingCategory} from '../core/training';
import {automationEnabled} from '../core/automation/state';
import {sheetChoices,type SheetChoice} from '../core/automation/choices';

export type EntryDragIntent = 'entry' | 'training';
/** Equipment can describe either a possession or a proficiency. Preserve the
 * source's intent for the whole gesture without rewriting the catalog entry. */
export function entryDragIntent(entry:Entry,source:{libraryTab?:string;trainingSource?:boolean}={}):EntryDragIntent{
  return trainingCategory(entry)&&(entry.kind!=='item'||source.libraryTab==='weaponProperty'||source.trainingSource)?'training':'entry';
}
export function entryDragPage(entry:Entry,intent:EntryDragIntent,preservePage=false){
  if(preservePage)return;
  return intent==='training'?'主要':entry.kind==='spell'?'法术':entry.kind==='item'?'背包':entry.kind==='feature'&&entry.raw._category==='optionalfeature'?'特性':undefined;
}
/** Resolve the optional learning interception independently of the drop gesture. */
export function optionalFeatureLearningDrop(c:Character,entry:Entry,catalog:Entry[]):{choice:SheetChoice}|undefined{
  if(!automationEnabled(c)||entry.raw._category!=='optionalfeature'||!Array.isArray(entry.raw.featureType)||!entry.raw.featureType.length||!entry.raw.featureType.every((type:unknown)=>typeof type==='string'&&['ai','ei'].includes(type.trim().toLowerCase())))return;
  const choices=sheetChoices(c,catalog).filter(choice=>choice.sourceProgression==='optional'&&choice.options.some(option=>option.entry.id===entry.id));
  const choice=choices.find(choice=>!choice.restricted&&choice.options.some(option=>option.entry.id===entry.id&&!option.unavailable))||choices[0];
  // An unowned option keeps the existing explicit manual add path. A matching
  // learning choice retains its source/prerequisite restrictions instead.
  return choice?{choice}:undefined;
}
