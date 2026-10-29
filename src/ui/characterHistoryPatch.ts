import type {Character} from '../core/model';
import {applyPatch} from '../core/merge';
import type {SpellActionAuthority} from '../core/automation/spellActionAuthority';
import {assertProtectedResourceHistoryTravel} from '../core/automation/protectedResourceHistoryTravel';

/** Keep intentional three-way Undo/redo. Only its protected bookkeeping delta
 * is gated by authority read at the moment this restore actually executes. */
export function applyCharacterHistoryPatch(live:Character,from:Character,to:Character,readAuthority:()=>SpellActionAuthority):Character{
 const candidate=applyPatch(live,from,to) as Character;
 assertProtectedResourceHistoryTravel(live,candidate,readAuthority());
 return candidate;
}
