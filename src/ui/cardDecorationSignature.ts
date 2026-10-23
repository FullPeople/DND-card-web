import type {Character} from '../core/model';
import {visualConditions} from './cardVisualState';
import {classBadge} from './classBadges';

/** Decoration reads status visuals and the primary class watermark. Source
 * publication, balances, notes and palette CSS do not rebuild its SVG tree. */
export function cardDecorationSignature(character:Character){
 const effects=visualConditions(character),primary=character.selections.filter(row=>row.entry.kind==='class').reduce<(typeof character.selections)[number]|undefined>((best,row)=>!best||row.level>best.level?row:best,undefined);
 return JSON.stringify([character.id,[...effects.active].sort(),effects.exhaustion,primary&&classBadge(primary.entry)?.url]);
}
