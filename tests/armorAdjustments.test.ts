import {describe,it,expect} from 'vitest';
import {type Character} from '../src/core/model';
import {irCharacter as newCharacter,irFixture} from './helpers/irFixture';
import {evaluate} from '../src/core/engine';
import {armorAdjustmentReview,resolveLegacyArmorAdjustments} from '../src/core/armorAdjustments';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {importOwlbear,validateCharacter} from '../src/core/validation';

const legacy=(bonus=2)=>{const c=newCharacter();c.abilities.dex=14;c.sheetBonuses={ac:bonus,hp:3};c.adjustments=[{id:'suite-ac',target:'ac',value:16,reason:'枭熊场景'},{id:'speed',target:'speed',value:40,reason:'另一记录'}];return c;};
describe('explicit legacy armor recovery',()=>{
 it('reading preserves old totals and evidence, and makes their unsupported ownership visible',()=>{
  const c=legacy(),before=structuredClone(c),review=armorAdjustmentReview(c);
  expect(review).toMatchObject({previousTotal:18,ruleTotal:12,previousBonus:2,convertedBonus:6});
  expect(validateCharacter(exportCharacter(c)).adjustments).toEqual(c.adjustments);
  expect(evaluate(c).issues.some(i=>i.id==='legacy-ac:suite-ac')).toBe(true);
  expect(c).toEqual(before);
 });
 it.each([2,-2,0])('restores rule AC without changing the existing %i offset or unrelated data',bonus=>{
  const c=legacy(bonus),before=structuredClone(c);resolveLegacyArmorAdjustments(c,'restore');
  expect(evaluate(c).ac).toBe(12+bonus);expect(c.sheetBonuses).toEqual(before.sheetBonuses);
  expect(c.abilities).toEqual(before.abilities);expect(c.baseHp).toBe(before.baseHp);
  expect(c.adjustments).toEqual([before.adjustments![1]]);
  expect(c.armorAdjustmentHistory?.[0]).toMatchObject({action:'restore',records:[before.adjustments![0]],previousTotal:16+bonus,resultingBonus:bonus});
  const resolved=structuredClone(c);resolveLegacyArmorAdjustments(c,'restore');expect(c).toEqual(resolved);
  c.abilities.dex=16;expect(evaluate(c).ac).toBe(13+bonus);
 });
 it.each([3,-2,0])('converts current total with %i offset once, rather than adding the old offset twice',bonus=>{
  const c=legacy(bonus),previous=evaluate(c).ac;resolveLegacyArmorAdjustments(c,'convert');
  expect(evaluate(c).ac).toBe(previous);expect(c.sheetBonuses?.ac).toBe(previous-12);
  const resolved=structuredClone(c);resolveLegacyArmorAdjustments(c,'convert');expect(c).toEqual(resolved);
  c.sheetBonuses!.ac=0;expect(evaluate(c).ac).toBe(12);
 });
 it('retains every legacy record in original order, with the last active record determining the old total',()=>{
  const c=legacy();c.adjustments!.push({id:'later',target:'ac',value:19,reason:'以前的裁定'});
  resolveLegacyArmorAdjustments(c,'convert');expect(evaluate(c).ac).toBe(21);
  expect(c.armorAdjustmentHistory?.[0].records.map(r=>r.id)).toEqual(['suite-ac','later']);
  const restored=importOwlbear(exportLinkedOwlbear(c,evaluate(c)));
  expect(restored.armorAdjustmentHistory).toEqual(c.armorAdjustmentHistory);expect(evaluate(restored).ac).toBe(21);
 });
 it('keeps valid rule-set and additive effects after recovery and after their source changes',()=>{
  const c=legacy();c.selections.push({id:'rules',level:1,quantity:1,equipped:false,entry:{id:'rules',name:'测试护甲规则',english:'Armor rule',kind:'feat',edition:'2024',source:'XPHB',packId:'test',revision:'1',raw:{},entries:[],effects:[{op:'set',target:'ac',value:15},{op:'add',target:'ac',value:1}]}});
  c.selections[0].entry=irFixture(c.selections[0].entry);resolveLegacyArmorAdjustments(c,'restore');expect(evaluate(c).ac).toBe(18);
  c.selections[0].entry.effects!.push({op:'add',target:'ac',value:2});c.selections[0].entry=irFixture(c.selections[0].entry);expect(evaluate(c).ac).toBe(20);
  c.sheetBonuses!.ac=0;expect(evaluate(c).ac).toBe(18);
 });
 it('rejects impossible conversions before mutation and validates archived evidence',()=>{
  const c=legacy(9999);c.adjustments![0].value=10000;const before=structuredClone(c);
  expect(()=>resolveLegacyArmorAdjustments(c,'convert')).toThrow('超出范围');expect(c).toEqual(before);
  const valid=legacy();resolveLegacyArmorAdjustments(valid,'restore');
  expect(()=>validateCharacter({...valid,armorAdjustmentHistory:[{...valid.armorAdjustmentHistory![0],ruleTotal:Infinity}]})).toThrow('旧护甲');
 });
 it('new explicit Owlbear imports keep AC as an offset with the original snapshot, never an absolute override',()=>{
  const c=newCharacter();c.abilities.dex=14;c.sheetBonuses={ac:5};const source=exportOwlbear(c,evaluate(c));
  const imported=importOwlbear(source);expect(evaluate(imported).ac).toBe(17);expect(imported.sheetBonuses?.ac).toBe(5);
  expect(imported.adjustments?.some(a=>a.target==='ac')).toBe(false);expect(imported.externalSnapshot).toEqual(source);
  imported.abilities.dex=16;expect(evaluate(imported).ac).toBe(18);
 });
});
