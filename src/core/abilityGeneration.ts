import {ABILITIES,type Ability,type Character} from './model';

export type AbilityValues=Record<Ability,number>;
export type AbilityRoll={dice:number[];dropped:number;score:number};
export const POINT_BUY_BUDGET=27;
export const POINT_BUY_SCORES=[8,9,10,11,12,13,14,15] as const;
const costs=[0,1,2,3,4,5,7,9];

export function pointBuyCost(score:number):number {
 if(!Number.isInteger(score)||score<8||score>15)throw Error('购点属性必须为 8 至 15 的整数。');
 return costs[score-8];
}
export function pointBuySpent(values:AbilityValues):number {
 return ABILITIES.reduce((total,ability)=>total+pointBuyCost(values[ability]),0);
}
export function pointBuyValues(values:AbilityValues):AbilityValues {
 if(pointBuySpent(values)!==POINT_BUY_BUDGET)throw Error('请分配完 27 点后再应用。');
 return Object.fromEntries(ABILITIES.map(ability=>[ability,values[ability]])) as AbilityValues;
}
export function abilityRoll(dice:readonly number[]):AbilityRoll {
 if(dice.length!==4||dice.some(value=>!Number.isInteger(value)||value<1||value>6))throw Error('每组需要四枚有效的 d6 结果。');
 const dropped=dice.indexOf(Math.min(...dice));
 return {dice:[...dice],dropped,score:dice.reduce((sum,value)=>sum+value,0)-dice[dropped]};
}
export function rollAbilityScores(d6:()=>number):AbilityRoll[] {
 return Array.from({length:6},()=>abilityRoll(Array.from({length:4},d6)));
}
/** Rejection sampling gives every face the same number of byte values. */
export function d6FromRandomByte(next:()=>number):number {
 for(;;){const value=next();if(!Number.isInteger(value)||value<0||value>255)throw Error('随机数来源返回了无效结果。');if(value<252)return value%6+1;}
}
export function assignedAbilityValues(rolls:readonly AbilityRoll[],order:readonly number[]):AbilityValues {
 if(rolls.length!==6||order.length!==6||new Set(order).size!==6||order.some(index=>!Number.isInteger(index)||index<0||index>5))throw Error('六组结果必须各分配一次。');
 for(const roll of rolls){const checked=abilityRoll(roll.dice);if(checked.score!==roll.score||checked.dropped!==roll.dropped)throw Error('随机结果与骰子记录不符。');}
 return Object.fromEntries(ABILITIES.map((ability,index)=>[ability,rolls[order[index]].score])) as AbilityValues;
}
/** Apply only after validating the entire preview and its current-card baseline. */
export function replaceBaseAbilities(c:Character,values:AbilityValues,baseline:{id:string;abilities:AbilityValues}):void {
 if(c.id!==baseline.id)throw Error('角色已切换，请重新生成。');
 if(ABILITIES.some(ability=>c.abilities[ability]!==baseline.abilities[ability]))throw Error('基础属性已变化，请重新核对。');
 if(Object.keys(values).length!==6||ABILITIES.some(ability=>!Number.isSafeInteger(values[ability])||values[ability]<1||values[ability]>30))throw Error('基础属性必须为 1 至 30 的整数。');
 c.abilities={...c.abilities,...values};
}
