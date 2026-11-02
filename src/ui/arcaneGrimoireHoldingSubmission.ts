import {grimoireHoldingDataSafe} from '../core/automation/arcaneGrimoireHolding';
import type {Character} from '../core/model';
type EditAction=(draft:Character)=>void;
const holdingEdits=new WeakSet<EditAction>();
/** Transient tag only: App and callback still require current authority. */
export function grimoireHoldingEdit(action:EditAction):EditAction{holdingEdits.add(action);return action;}
/** Do not hydrate/sync manual pools around a source-intent-only transaction. */
export function applyGrimoireHoldingEdit(current:Character,action:EditAction):Character|undefined{
 if(!holdingEdits.has(action))return;
 if(!grimoireHoldingDataSafe(current))return current;
 const draft=structuredClone(current);action(draft);return JSON.stringify(draft)===JSON.stringify(current)?current:draft;
}
