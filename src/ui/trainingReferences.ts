import type {Entry} from '../core/model';
import {equipmentTraining,proficiencyText} from '../core/proficiencyText';

/** Display categories before same-name equipment; explicit item/spell UIDs retain their type. */
export function trainingDisplayText(value:string,source:string,group:string,namedEntries:readonly Entry[]=[]):string{
 const category=equipmentTraining(value);
 if(category?.[3]===group)return proficiencyText(value,source,group);
 const entry=namedEntries.find(entry=>entry.source===source)||namedEntries[0];
 return entry?`{@${group==='languages'?'language':'item'} ${entry.name}|${entry.source}}`:proficiencyText(value,source,group);
}
