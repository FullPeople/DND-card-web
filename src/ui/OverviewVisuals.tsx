import {useMemo,type ReactNode} from 'react';
import {newCharacter,type Entry} from '../core/model';
import {CardVisualContext,visualConditions} from './cardVisualState';
import {AdaptiveCardAtmosphere,AdaptiveFrameArt,adaptiveConditionClasses} from './AdaptiveCardAtmosphere';

export type OverviewCondition={id:string;name:string;entry?:Entry;level?:number};
export function overviewConditionEntry(condition:OverviewCondition):Entry{
 return condition.entry||{id:`overview-condition:${condition.id}`,name:condition.name,english:condition.id,kind:'condition',source:'IMPORTED',packId:'imported',edition:'both',revision:'1',entries:[],raw:{_suiteStatusId:condition.id}};
}
/** Reuse condition identity only; this model never enters saved rule data. */
export function useOverviewVisuals(conditions:OverviewCondition[]){
 const key=JSON.stringify(conditions);
 return useMemo(()=>{const character=newCharacter();character.selections=conditions.map(condition=>({id:condition.id,entry:overviewConditionEntry(condition),level:condition.level||1,quantity:1,equipped:false}));return {character,...visualConditions(character)};},[key]);
}
export function OverviewVisuals({visuals,children,...props}:{visuals:ReturnType<typeof useOverviewVisuals>;children:ReactNode}&React.HTMLAttributes<HTMLElement>){
 const {active,exhaustion}=visuals;
 return <CardVisualContext.Provider value={{active,exhaustion}}><article {...props} className={`console-resource-card resource179-card ${adaptiveConditionClasses(active)}`}><div className="resource179-face"><AdaptiveCardAtmosphere active={active} exhaustion={exhaustion}/>{children}</div><AdaptiveFrameArt active={active} exhaustion={exhaustion}/></article></CardVisualContext.Provider>;
}
