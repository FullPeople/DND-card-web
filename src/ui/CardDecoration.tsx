import type {RefObject} from 'react';
import type {Character} from '../core/model';
import {CardAtmosphere} from './CardAtmosphere';
import {AdaptiveCardAtmosphere} from './AdaptiveCardAtmosphere';
import {AdaptivePaperLayers} from './AdaptivePaperLayers';
import {visualConditions} from './cardVisualState';
import {classBadge} from './classBadges';
import {useCardGravity} from './useCardGravity';
import {useAdaptiveCardGravity} from './useAdaptiveCardGravity';

/** Decorative layers mount after the original card has painted. */
export function CardDecoration({character,paper,adaptive,editing,page,compact}:{character:Character;paper:RefObject<HTMLDivElement|null>;adaptive:boolean;editing:boolean;page:string;compact:boolean}){
 const effects=visualConditions(character),primary=character.selections.filter(row=>row.entry.kind==='class').reduce<(typeof character.selections)[number]|undefined>((best,row)=>!best||row.level>best.level?row:best,undefined),badge=primary&&classBadge(primary.entry);
 useCardGravity(paper,!adaptive&&!editing&&effects.active.has('incapacitated'),page,character.id);
 useAdaptiveCardGravity(paper,adaptive&&effects.active.has('incapacitated'),character.id,`${page}:${compact}`,editing);
 return adaptive?<><AdaptiveCardAtmosphere key={character.id} active={effects.active} exhaustion={effects.exhaustion} editing={editing} watermarkUrl={badge?.url}/><AdaptivePaperLayers paper={paper} active={effects.active} exhaustion={effects.exhaustion} editing={editing} layoutKey={`${character.id}:${page}`}/></>:<CardAtmosphere key={character.id} character={character}/>;
}
