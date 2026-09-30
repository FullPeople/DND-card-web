import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {spellState} from '../src/core/characterDetails';
import {capacitySlots,knownSpellCapacity,sourceCapacity} from '../src/core/spellCapacity';
import {cantripGroups,spellIsReady,chooseKnownSpell,chooseCantrip,clearCantrip} from '../src/core/spellWorkspace';
import {prepareSpellEntry,setPreparedSpell} from '../src/core/spells';
import {chooseSourceSpell} from '../src/core/sourceCantrips';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
const spell=(id:string,level=1):Entry=>({id,kind:'spell',name:id,english:id,source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:[],raw:{level}});
describe('spell capacities and retained overflow',()=>{
 it('refuses an overflow selection at full capacity and moves it into a real vacancy after clearing a slot',()=>{
  const c=newCharacter();c.spellSettings={...spellState(c),capacityAdjustment:2};const a=prepareSpellEntry(c,spell('a'))!,b=prepareSpellEntry(c,spell('b'))!;c.spellSettings.capacityAdjustment=1;
  expect(prepareSpellEntry(c,spell('b'))).toBeUndefined();setPreparedSpell(c,a,false);expect(prepareSpellEntry(c,spell('b'))).toBe(b);expect(c.spellSettings.prepared).toEqual([b,'']);
  const caster={...spell('caster'),kind:'class' as const,raw:{spellcastingAbility:'int',cantripProgression:[2]}};c.selections.push({id:'caster',entry:caster,level:1,quantity:1,equipped:false});const x=chooseCantrip(c,spell('x',0),'caster').id!,y=chooseCantrip(c,spell('y',0),'caster').id!;c.spellSettings.cantripCapacityAdjustments={caster:-1};expect(chooseCantrip(c,spell('y',0),'caster').error).toContain('已满');clearCantrip(c,'caster',0);expect(chooseCantrip(c,spell('y',0),'caster').id).toBe(y);expect(cantripGroups(c)[0].slots).toEqual([y,'']);expect(c.selections.some(s=>s.id===x)).toBe(true);
 });

 it('has no blank-card groups, uses one explicit preparation allowance for both cantrips and levelled spells',()=>{
  const c=newCharacter();expect(cantripGroups(c)).toEqual([]);expect(prepareSpellEntry(c,spell('a'))).toBeUndefined();c.spellSettings={...spellState(c),capacityAdjustment:2};
  const a=prepareSpellEntry(c,spell('a',0))!,b=prepareSpellEntry(c,spell('b'))!;expect(c.spellSettings.prepared).toEqual([a,b]);expect(cantripGroups(c)).toEqual([]);
  c.spellSettings.capacityAdjustment=1;expect(capacitySlots(c.spellSettings.prepared,spellState(c).capacity)).toEqual({slots:[a],overflow:[b]});expect(spellIsReady(c,c.selections.find(s=>s.id===b)!)).toBe(false);
  c.spellSettings.capacityAdjustment=2;expect(spellIsReady(c,c.selections.find(s=>s.id===b)!)).toBe(true);expect(validateCharacter(exportCharacter(c))).toEqual(c);
 });
 it('bounds known selections and source spell slots, preserving signed adjustments and overflow on import',()=>{
  const c=newCharacter();c.spellSettings={...spellState(c),mode:'known',modeOverride:true,knownCapacityAdjustment:1,sourceCapacityAdjustments:{manual:2}};
  expect(knownSpellCapacity(c)).toBe(1);expect(chooseKnownSpell(c,spell('a')).id).toBeTruthy();expect(chooseKnownSpell(c,spell('b')).error).toContain('已满');
  expect(chooseSourceSpell(c,spell('gift',3),'manual').id).toBeTruthy();expect(sourceCapacity(c,'manual').total).toBe(2);expect(capacitySlots(['','x','','y'],1)).toEqual({slots:[''],overflow:['x','y']});
  c.spellSettings.knownCapacityAdjustment=-1;c.spellSettings.sourceCapacityAdjustments={manual:0};const restored=validateCharacter(exportCharacter(c));expect(restored.selections).toHaveLength(2);expect(restored.selections.every(s=>!spellIsReady(restored,s))).toBe(true);
 });
});
