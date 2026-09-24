import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportOwlbear} from '../src/core/export';
import {validateCharacter,importOwlbear} from '../src/core/validation';

it('AC adjustment adds to recalculated AC and survives native and Owlbear backups',()=>{
 const c=newCharacter();c.abilities.dex=14;c.sheetBonuses={ac:3};
 expect(evaluate(c).ac).toBe(15);c.abilities.dex=16;expect(evaluate(c).ac).toBe(16);
 expect(evaluate(validateCharacter(exportCharacter(c))).ac).toBe(16);
 const obr=exportOwlbear(c,evaluate(c));expect(obr.core_stats.ac).toBe(16);expect(evaluate(importOwlbear(obr)).ac).toBe(16);
 c.adjustments=[{id:'legacy',target:'ac',value:18,reason:'已有设定'}];expect(evaluate(c).ac).toBe(21);
 c.sheetBonuses.ac=-2;expect(evaluate(c).ac).toBe(16);
 expect(evaluate(c).trace.ac).toContain('卡面调整 -2');
 expect(()=>validateCharacter({...c,sheetBonuses:{ac:Infinity}})).toThrow();
});
