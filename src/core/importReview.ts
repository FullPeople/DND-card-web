import {selectionAllowed,type Character} from './model';
import {evaluate} from './engine';

export function reviewImport(original:Character,effective:Character,currentEdition:Character['edition']){
 const disabled=effective.selections.filter(s=>!selectionAllowed(effective,s.entry));
 const totalLevel=original.selections.filter(s=>s.entry.kind==='class').reduce((sum,s)=>sum+s.level,0);
 const effectiveLevel=evaluate(effective).level;
 return {editionMismatch:original.edition!==currentEdition,editionChanged:original.edition!==effective.edition,disabled,totalLevel,effectiveLevel};
}
