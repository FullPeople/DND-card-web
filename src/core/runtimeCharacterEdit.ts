import type {Character} from './model';
import {setResource} from './resources';
import {rememberSourceSpellUses} from './automation/sourceSpellState';
import {automationNeedsInitialization,supportedAutomation} from './automation/state';

type Action=(draft:Character)=>void;
type Intent={field:'hp'|'tempHp';value:number}|{field:'resource';id:string;value:number};
const intents=new WeakMap<Action,Intent>();
const construction=new WeakMap<Character,Character>();
export const runtimeCharacterBase=(character:Character)=>construction.get(character)||character;
function fork(character:Character,next:Character){construction.set(next,runtimeCharacterBase(character));return next;}
function apply(draft:Character,intent:Intent){
 if(intent.field==='resource')setResource(draft,intent.id,intent.value);
 else draft.runtime[intent.field]=intent.value;
}
/** Only explicit balance setters qualify. History keys and arbitrary callbacks never do. */
export function runtimeValueEdit(field:'hp'|'tempHp',value:number):Action{return marked({field,value});}
export function resourceBalanceEdit(id:string,value:number):Action{return marked({field:'resource',id,value});}
function marked(intent:Intent):Action{const action:Action=draft=>apply(draft,intent);intents.set(action,intent);return action;}
export function applyRuntimeCharacterEdit(character:Character,action:Action):Character|undefined{
 const intent=intents.get(action);
 if(!intent||!Number.isFinite(intent.value)||automationNeedsInitialization(character)||!supportedAutomation(character))return;
 // Legacy casting recovery belongs to the normal reconciliation path.
 if(character.selections.some(s=>s.entry.kind==='class'&&s.entry.packId==='imported'&&s.entry.source==='IMPORTED'&&!s.entry.raw._castingSource))return;
 if(intent.field!=='resource')return character.runtime[intent.field]===intent.value?character:fork(character,{...character,runtime:{...character.runtime,[intent.field]:intent.value}});
 const old=character.runtime.resources[intent.id];if(!old)return character;
 const value=Math.max(0,old.unlimited?intent.value:Math.min(old.max,intent.value));if(value===old.current)return character;
 const resource={...old,...(old.featureGrant?{featureGrant:structuredClone(old.featureGrant)}:{})};
 const runtime={...character.runtime,resources:{...character.runtime.resources,[intent.id]:resource},
  ...(old.featureGrant?{featureResourceArchive:{...character.runtime.featureResourceArchive}}:{}),
  ...(character.spellSettings?.special?{sourceSpellSpent:{...character.runtime.sourceSpellSpent}}:{})};
 const draft={...character,runtime,...(intent.id.startsWith('spell-slot:')&&character.spellSettings?{spellSettings:{...character.spellSettings,slots:{...character.spellSettings.slots}}}:{})};
 rememberSourceSpellUses(draft);apply(draft,intent);rememberSourceSpellUses(draft);
 return fork(character,draft);
}
