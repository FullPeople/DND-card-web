import type {Character} from './model';
import {characterConstructionBase,forkCharacterConstruction} from './characterConstruction';
import {applyPatch,sameValue} from './merge';

type EditAction=(draft:Character)=>void;
type DisplayField='name'|'player'|'portraitFrameHidden'|'tokenPortraitTransform'|'portraitPageFraming'|'overviewSpellsHidden'|'palette'|'componentPalette';
type Biography=NonNullable<Character['biography']>;
const displayFields:DisplayField[]=['name','player','portraitFrameHidden','tokenPortraitTransform','portraitPageFraming','overviewSpellsHidden','palette','componentPalette'];
const identityFields=new Set<keyof Character['identity']>(['age','gender','alignment','description']);
const biographyFields=new Set<keyof Biography>(['hometown','height','weight','traits','ideals','bonds','flaws','story','backgroundDescription','portraitNotes']);
type DisplayIntent={patch:Partial<Pick<Character,DisplayField>>}|{group:'identity';field:keyof Character['identity'];value:string}|{group:'biography';field:keyof Biography;value:string};
const displayEdits=new WeakMap<EditAction,DisplayIntent>();
/** Explicit display-only intent. Ordinary callbacks and history keys never opt out of rules. */
export function displayCharacterEdit<K extends DisplayField>(field:K,value:Character[K]):EditAction{
 const action:EditAction=draft=>{draft[field]=value;};
 if(displayFields.includes(field))displayEdits.set(action,{patch:{[field]:value}});return action;
}
export function displayIdentityEdit(field:keyof Character['identity'],value:string):EditAction{
 const action:EditAction=draft=>{draft.identity[field]=value;};
 if(identityFields.has(field))displayEdits.set(action,{group:'identity',field,value});return action;
}
export function displayBiographyEdit(field:keyof Biography,value:string):EditAction{
 const action:EditAction=draft=>{(draft.biography||={})[field]=value;};
 if(biographyFields.has(field))displayEdits.set(action,{group:'biography',field,value});return action;
}
/** A complete palette import or restore is one display edit and one save. */
export function displayCharacterPaletteEdit(value:Pick<Character,'palette'|'componentPalette'>):EditAction{
 const action:EditAction=draft=>{draft.palette=value.palette;draft.componentPalette=value.componentPalette;};
 displayEdits.set(action,{patch:{palette:value.palette,componentPalette:value.componentPalette}});return action;
}
export function applyDisplayCharacterEdit(character:Character,action:EditAction):Character|undefined{
 const intent=displayEdits.get(action);if(!intent)return;
 if('patch' in intent){
  if(Object.entries(intent.patch).every(([field,value])=>character[field as DisplayField]===value))return character;
  return forkCharacterConstruction(character,{...character,...intent.patch});
 }
 const current=character[intent.group];if(current?.[intent.field as keyof typeof current]===intent.value)return character;
 return forkCharacterConstruction(character,{...character,[intent.group]:{...current,[intent.field]:intent.value}});
}
const displayKeys=new Set<string>([...displayFields,'revision','updatedAt']);
function sameTextMechanics(before:object|undefined,after:object|undefined,fields:ReadonlySet<string>):boolean{
 const a=before as Record<string,unknown>|undefined,b=after as Record<string,unknown>|undefined;
 return [...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].every(key=>fields.has(key)||a?.[key]===b?.[key]);
}
function mergeText(current:unknown,before:unknown,after:unknown):unknown{
 if(before===after||current===after)return current;
 return current===before?after:applyPatch(current,before,after);
}
/** Shallow identity is sufficient: general edits clone the card before mutation. */
export function sameCharacterMechanics(before:Character|undefined,after:Character):boolean{
 if(!before)return false;
 const keys=new Set([...Object.keys(before),...Object.keys(after)]);
 return [...keys].every(key=>displayKeys.has(key)||
  (key==='identity'?(!before.identity||!after.identity?before.identity===after.identity:sameTextMechanics(before.identity,after.identity,identityFields)):
   key==='biography'?sameTextMechanics(before.biography,after.biography,biographyFields):before[key as keyof Character]===after[key as keyof Character]));
}

/** Overlay current presentation and changed balances; never replace initialized view resources with an unchanged legacy snapshot. */
export function displayCharacterView(view:Character,character:Character):Character{
 const base=characterConstructionBase(character);if(base===character)return view;
 const display=Object.fromEntries(displayFields.map(field=>[field,character[field]]));
 return {...view,...display,identity:character.identity,biography:character.biography,
  ...(character.runtime!==base.runtime?{runtime:character.runtime}:{}),
  ...(character.spellSettings!==base.spellSettings?{spellSettings:character.spellSettings}:{}),revision:character.revision,updatedAt:character.updatedAt};
}

/** Apply only the text/display delta, retaining live mechanics and ordinary three-way conflicts. Unknown changes use the full history path. */
export function displayCharacterHistoryPatch(live:Character,from:Character,to:Character):Character|undefined{
 if(!sameCharacterMechanics(from,to))return;
 const next={...live};let changed=false;
 for(const field of displayFields)if(!sameValue(from[field],to[field])){
  const value=applyPatch(live[field],from[field],to[field]);
  if(value===undefined)delete next[field];else (next as Record<string,unknown>)[field]=value;changed=true;
 }
 for(const [group,fields] of [['identity',identityFields],['biography',biographyFields]] as const){
  const before=from[group] as Record<string,unknown>|undefined,after=to[group] as Record<string,unknown>|undefined,current=live[group] as Record<string,unknown>|undefined;
  let value:Record<string,unknown>|undefined;
  for(const field of fields)if(before?.[field]!==after?.[field]){
   value||={...current};const patch=mergeText(current?.[field],before?.[field],after?.[field]);
   if(patch===undefined)delete value[field];else value[field]=patch;
  }
  if(value){
   if(group==='biography'&&to.biography===undefined&&!Object.keys(value).length)delete next.biography;
   else (next as Record<string,unknown>)[group]=value;
   changed=true;
  }
 }
 return changed?forkCharacterConstruction(live,next):live;
}
