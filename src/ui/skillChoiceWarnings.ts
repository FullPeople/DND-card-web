import {evaluate} from '../core/engine';
import type {Character} from '../core/model';
import type {SheetChoice} from '../core/automation/choices';

/** Inspect other active grants without rewriting a saved choice or its quota. */
export function classSkillWarnings(c:Character,choice:SheetChoice):Record<string,string[]>{
 const owner=c.selections.find(row=>row.id===choice.ownerId);
 if(c.edition!=='2014'||choice.channel!=='skills'||choice.restricted||owner?.entry.kind!=='class'||!choice.id.startsWith(`${owner.id}:skills:`))return {};
 const answers={...c.answers};delete answers[choice.id];
 const skills=evaluate({...c,answers}).skills;
 return Object.fromEntries(choice.options.flatMap(option=>{
  const skill=skills[option.value];return skill?.proficient?[[option.value,[...new Set(skill.sources)]]]:[];
 }));
}
