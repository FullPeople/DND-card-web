import type {Character} from './model';

type EditAction=(draft:Character)=>void;
type DisplayField='name'|'player';
const displayEdits=new WeakMap<EditAction,{field:DisplayField;value:string}>();
/** Explicit display-only intent. Ordinary callbacks and history keys never opt out of rules. */
export function displayCharacterEdit(field:DisplayField,value:string):EditAction{
 const action:EditAction=draft=>{draft[field]=value;};
 displayEdits.set(action,{field,value});return action;
}
export function applyDisplayCharacterEdit(character:Character,action:EditAction):Character|undefined{
 const edit=displayEdits.get(action);if(!edit)return;
 return character[edit.field]===edit.value?character:{...character,[edit.field]:edit.value};
}
const displayKeys=new Set(['name','player','revision','updatedAt']);
/** Shallow identity is sufficient: general edits clone the card before mutation. */
export function sameCharacterMechanics(before:Character|undefined,after:Character):boolean{
 if(!before)return false;
 const keys=new Set([...Object.keys(before),...Object.keys(after)]);
 return [...keys].every(key=>displayKeys.has(key)||before[key as keyof Character]===after[key as keyof Character]);
}
