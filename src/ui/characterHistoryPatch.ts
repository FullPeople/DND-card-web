import {assertGrimoireHistoryInput,assertGrimoireHoldingHistory} from '../core/automation/arcaneGrimoireHolding';
import type {Character} from '../core/model';
import {applyPatch} from '../core/merge';
import type {SpellActionAuthority} from '../core/automation/spellActionAuthority';
import {assertProtectedResourceHistoryTravel} from '../core/automation/protectedResourceHistoryTravel';

/** Keep intentional three-way Undo/redo. Only its protected bookkeeping delta
 * is gated by authority read at the moment this restore actually executes. */
export function applyCharacterHistoryPatch(live:Character,from:Character,to:Character,readAuthority:()=>SpellActionAuthority):Character{
 for(const card of [live,from,to])assertGrimoireHistoryInput(card);
 const candidate=applyPatch(live,from,to) as Character;
 const authority=readAuthority();
 assertGrimoireHoldingHistory(live,candidate,authority);
 assertProtectedResourceHistoryTravel(live,candidate,authority);
 return candidate;
}
