import {assertGrimoireHistoryInput,assertGrimoireHoldingHistory} from '../core/automation/arcaneGrimoireHolding';
import type {Character} from '../core/model';
import {applyPatch} from '../core/merge';
import type {SpellActionAuthority} from '../core/automation/spellActionAuthority';
import {assertProtectedResourceHistoryTravel} from '../core/automation/protectedResourceHistoryTravel';
import {displayCharacterHistoryPatch} from '../core/displayCharacterEdit';
import {liveSpellActionAuthority} from '../core/automation/spellActionAuthority';

/** Keep intentional three-way Undo/redo. Only its protected bookkeeping delta
 * is gated by authority read at the moment this restore actually executes. */
export function applyCharacterHistoryPatch(live:Character,from:Character,to:Character,readAuthority:()=>SpellActionAuthority,options:{normalize?:(card:Character)=>Character;displayOnly?:boolean}={}):Character{
 const display=options.displayOnly===false?undefined:displayCharacterHistoryPatch(live,from,to);
 if(display===undefined&&options.normalize){live=options.normalize(live);from=options.normalize(from);to=options.normalize(to);}
 for(const card of [live,from,to])assertGrimoireHistoryInput(card);
 const candidate=display??applyPatch(live,from,to) as Character;
 const authority=readAuthority();
 if(display!==undefined){const current=liveSpellActionAuthority(authority);if(!current.valid||!current.canEdit)throw Error('当前角色卡只读或编辑权限无效，未执行。');}
 assertGrimoireHoldingHistory(live,candidate,authority);
 assertProtectedResourceHistoryTravel(live,candidate,authority);
 return candidate;
}
