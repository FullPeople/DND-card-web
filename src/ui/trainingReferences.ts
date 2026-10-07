import type {Entry} from '../core/model';
import {equipmentTraining,proficiencyText} from '../core/proficiencyText';

/** Display categories before same-name equipment; explicit item/spell UIDs retain their type. */
export function trainingDisplayText(value:string,source:string,group:string,namedEntries:readonly Entry[]=[]):string{
 const category=equipmentTraining(value);
 if(category?.[3]===group)return proficiencyText(value,source,group);
 const entry=namedEntries.find(entry=>entry.source===source)||namedEntries[0];
 return entry?`{@${group==='languages'?'language':'item'} ${entry.name}|${entry.source}}`:proficiencyText(value,source,group);
}

/** Only translate known tool names for display; authored captions and UIDs survive. */
export function trainingCaption(value:string,label:string,group?:string):string{
 const tag=/^\{@(\w+) ([^{}]+)\}$/.exec(value),parts=(tag?.[2]||value).split('|');
 if(group!=='tools'||parts[2]||tag&&tag[1]!=='item'||label!==parts[0])return label;
 const tool=/^\{@item ([^{}]+)\}$/.exec(proficiencyText(label));
 return tool?.[1].split('|')[2]||label;
}
