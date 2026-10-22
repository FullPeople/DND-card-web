import type {Character} from './model';

type EditAction=(draft:Character)=>void;
type DisplayField='name'|'player'|'portraitFrameHidden'|'tokenPortraitTransform'|'portraitPageFraming'|'overviewSpellsHidden'|'palette'|'componentPalette';
const displayEdits=new WeakMap<EditAction,Partial<Pick<Character,DisplayField>>>();
/** Explicit display-only intent. Ordinary callbacks and history keys never opt out of rules. */
export function displayCharacterEdit<K extends DisplayField>(field:K,value:Character[K]):EditAction{
 const action:EditAction=draft=>{draft[field]=value;};
 displayEdits.set(action,{[field]:value});return action;
}
/** A complete palette import or restore is one display edit and one save. */
export function displayCharacterPaletteEdit(value:Pick<Character,'palette'|'componentPalette'>):EditAction{
 const action:EditAction=draft=>{draft.palette=value.palette;draft.componentPalette=value.componentPalette;};
 displayEdits.set(action,{palette:value.palette,componentPalette:value.componentPalette});return action;
}
export function applyDisplayCharacterEdit(character:Character,action:EditAction):Character|undefined{
 const edit=displayEdits.get(action);if(!edit)return;
 return Object.entries(edit).every(([field,value])=>character[field as DisplayField]===value)?character:{...character,...edit};
}
const displayKeys=new Set(['name','player','portraitFrameHidden','tokenPortraitTransform','portraitPageFraming','overviewSpellsHidden','palette','componentPalette','revision','updatedAt']);
/** Shallow identity is sufficient: general edits clone the card before mutation. */
export function sameCharacterMechanics(before:Character|undefined,after:Character):boolean{
 if(!before)return false;
 const keys=new Set([...Object.keys(before),...Object.keys(after)]);
 return [...keys].every(key=>displayKeys.has(key)||before[key as keyof Character]===after[key as keyof Character]);
}
