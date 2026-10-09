import type {Entry} from '../core/model';
import {equipmentTraining,proficiencyText} from '../core/proficiencyText';
import {fallbackTrainingLabel} from './trainingLabels';

/** Display categories before same-name equipment; explicit item/spell UIDs retain their type. */
export function trainingDisplayText(value:string,source:string,group:string,namedEntries:readonly Entry[]=[]):string{
 const category=equipmentTraining(value);
 if(category?.[3]===group)return proficiencyText(value,source,group);
 const entry=namedEntries.find(entry=>entry.source===source)||namedEntries[0];
 if(entry)return `{@${group==='languages'?'language':'item'} ${entry.name}|${entry.source}}`;
 const label=fallbackTrainingLabel(value,group,source);
 return label?`{@item ${value}|${source}|${label}}`:proficiencyText(value,source,group);
}

/** Translate known fallback names for display; authored captions and UIDs survive. */
export function trainingCaption(value:string,label:string,group?:string,source='PHB'):string{
 const tag=/^\{@(\w+) ([^{}]+)\}$/.exec(value),parts=(tag?.[2]||value).split('|');
 if(parts[2]||tag&&tag[1]!=='item'||label!==parts[0])return label;
 const fallback=fallbackTrainingLabel(parts[0],group,parts[1]||source);
 if(fallback)return fallback;
 if(group!=='tools')return label;
 const tool=/^\{@item ([^{}]+)\}$/.exec(proficiencyText(label));
 return tool?.[1].split('|')[2]||label;
}
