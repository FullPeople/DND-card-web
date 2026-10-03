import {ABILITIES,type Entry} from '../model';
import type {Condition} from '../../data/automation/protocol';
import {irMechanics} from './ir';
const conditions=(rule?:Condition):string[]=>!rule?[]:'all'in rule?rule.all.flatMap(conditions):'any'in rule?rule.any.flatMap(conditions):'not'in rule?conditions(rule.not):['level','class.level','equipped','attuned','unarmored','shield','choice'].includes(rule.target)?[]:[`condition:${rule.target}`];
/** Dataset coverage and browser capabilities are separate facts. A reviewed
 * rule must stay visibly partial when this client cannot execute its target. */
export function irRuntimeGaps(entry:Entry):string[]{
 const model=irMechanics(entry),gaps:string[]=[];
 for(const modifier of model?.modifiers||[]){
  if(!ABILITIES.includes(modifier.target as any)&&!['ac','hp','speed.walk','initiative','passive','proficiency','attack.melee','attack.ranged','damage.melee','damage.ranged','attack.spell','dc.spell','cantrips'].includes(modifier.target)&&!modifier.target.startsWith('skill:')&&!modifier.target.startsWith('save:'))gaps.push(`target:${modifier.target}`);
  if(modifier.stackGroup)gaps.push(`stack:${modifier.stackGroup}`);
  gaps.push(...conditions(modifier.condition));
 }
 for(const action of model?.actions||[])if(action.type!=='cast')gaps.push(`action:${action.type}`);
 return [...new Set(gaps)];
}
export function irGapLabel(gap:string):string{
 if(gap.startsWith('stack:'))return '同组效果叠加';
 if(gap.startsWith('condition:'))return gap.endsWith('ability')?'属性条件':'熟练条件';
 if(gap.startsWith('action:'))return '快捷动作';
 const target=gap.slice(7),labels:Record<string,string>={'attack.spellMelee':'近战法术命中','attack.spellRanged':'远程法术命中','damage.spell':'法术伤害','damage.spellMelee':'近战法术伤害','damage.spellRanged':'远程法术伤害',criticalDice:'重击骰',size:'体型','speed.fly':'飞行速度','speed.swim':'游泳速度','speed.climb':'攀爬速度','speed.burrow':'掘穴速度','speed.hover':'悬浮'};
 if(labels[target])return labels[target];
 return target.startsWith('sense:')?'感官':target.startsWith('resist:')?'伤害抗性':target.startsWith('immune:')?'伤害免疫':target.startsWith('vulnerable:')?'伤害易伤':target.startsWith('conditionImmune:')?'状态免疫':target;
}
