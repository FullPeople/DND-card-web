import {memo,type RefObject} from 'react';
import {cloudFeaturesEnabled} from '../cloud/availability';
import type {Character} from '../core/model';
import {CardAtmosphere} from './CardAtmosphere';
import {AdaptiveCardAtmosphere} from './AdaptiveCardAtmosphere';
import {AdaptivePaperLayers} from './AdaptivePaperLayers';
import {visualConditions} from './cardVisualState';
import {classBadge} from './classBadges';
import {useCardGravity} from './useCardGravity';
import {useAdaptiveCardGravity} from './useAdaptiveCardGravity';
import {useRetainedCardActive} from './RetainedCardVisibility';
import {cardDecorationSignature} from './cardDecorationSignature';

function CardGravityEffects({character,paper,adaptive,editing,page,compact}:{character:Character;paper:RefObject<HTMLDivElement|null>;adaptive:boolean;editing:boolean;page:string;compact:boolean}){
 const active=useRetainedCardActive(),effects=visualConditions(character);
 useCardGravity(paper,active&&!adaptive&&!editing&&effects.active.has('incapacitated'),page,character.id);
 useAdaptiveCardGravity(paper,active&&adaptive&&effects.active.has('incapacitated'),character.id,`${page}:${compact}`,editing);
 return null;
}

/** Decorative layers mount after the original card has painted. */
function CardDecorationContent({character,paper,adaptive,editing,page,compact}:{character:Character;paper:RefObject<HTMLDivElement|null>;adaptive:boolean;editing:boolean;page:string;compact:boolean}){
 const effects=visualConditions(character),primary=character.selections.filter(row=>row.entry.kind==='class').reduce<(typeof character.selections)[number]|undefined>((best,row)=>!best||row.level>best.level?row:best,undefined),badge=primary&&classBadge(primary.entry);
 return <><CardGravityEffects character={character} paper={paper} adaptive={adaptive} editing={editing} page={page} compact={compact}/>{adaptive?<><AdaptiveCardAtmosphere key={character.id} active={effects.active} exhaustion={effects.exhaustion} editing={editing} watermarkUrl={badge?.url}/><AdaptivePaperLayers paper={paper} active={effects.active} exhaustion={effects.exhaustion} editing={editing} layoutKey={`${character.id}:${page}`}/></>:<CardAtmosphere key={character.id} character={character}/>}</>;
}

export const CardDecoration=cloudFeaturesEnabled?memo(CardDecorationContent,(before,after)=>before.paper===after.paper&&before.adaptive===after.adaptive&&before.editing===after.editing&&before.page===after.page&&before.compact===after.compact&&cardDecorationSignature(before.character)===cardDecorationSignature(after.character)):CardDecorationContent;
