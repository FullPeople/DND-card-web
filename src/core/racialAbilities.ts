import {ABILITIES,type Character,type Selection} from './model';
import {irAbilityScores,irMechanics,irSelectionActive} from './automation/ir';
export type RacialAbilityPlan={bonuses:Partial<Record<typeof ABILITIES[number],number>>;trace:Partial<Record<typeof ABILITIES[number],string[]>>;issues:import('./model').Issue[]};
export function planRacialAbilities(c:Character,selection:Selection):RacialAbilityPlan{
 const result:RacialAbilityPlan={bonuses:{},trace:{},issues:[]};if(selection.entry.kind!=='race'||!irSelectionActive(c,selection))return result;
 const scores=irAbilityScores({...c,selections:[selection]});for(const ability of ABILITIES){const amount=scores[ability]-c.abilities[ability];if(amount){result.bonuses[ability]=amount;result.trace[ability]=[`种族：${selection.entry.name} · ${selection.entry.source} ${amount>=0?'+':''}${amount}`];}}
 if(!irMechanics(selection.entry))result.issues.push({id:`racial-ability:${selection.id}`,selectionId:selection.id,severity:'warning',message:`${selection.entry.name}：属性规则数据尚未审阅，未自动叠加。`});return result;
}
