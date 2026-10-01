import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
it('adds signed skill bonuses after existing manual totals and includes perception in passive',()=>{
 const c=newCharacter();c.abilities.wis=16;c.proficiencies={perception:true};c.expertise={perception:true};
 const before=evaluate(c);c.skillBonuses={perception:3,athletics:-2};const after=evaluate(c);
 expect(after.skills.perception.value).toBe(before.skills.perception.value+3);expect(after.passive).toBe(before.passive+3);expect(after.skills.athletics.value).toBe(-2);
 c.adjustments=[{id:'legacy',target:'skill:perception',value:8,reason:'原卡总值'}];expect(evaluate(c).skills.perception.value).toBe(11);
 c.adjustments.push({id:'passive',target:'passive',value:18,reason:'独立感官'});expect(evaluate(c).passive).toBe(18);
 delete c.skillBonuses.perception;expect(evaluate(c).skills.perception.value).toBe(8);
});
it('persists bonuses in native and bridge exports without compounding on repeated reads',()=>{
 const c=newCharacter();c.skillBonuses={perception:4,stealth:-1};const original=evaluate(c);
 const native=validateCharacter(exportCharacter(c));expect(native.skillBonuses).toEqual(c.skillBonuses);
 const bridge=importOwlbear(exportLinkedOwlbear(native,evaluate(native)));expect(bridge.skillBonuses).toEqual(c.skillBonuses);expect(evaluate(bridge).skills).toEqual(original.skills);
 expect(()=>validateCharacter({...c,skillBonuses:{unknown:1}})).toThrow(/技能额外/);expect(()=>validateCharacter({...c,skillBonuses:{stealth:0.5}})).toThrow(/技能额外/);
});
