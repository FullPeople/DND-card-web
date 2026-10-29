import {expect,it,vi} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import * as engine from '../src/core/engine';
import {spellState,spellValues} from '../src/core/characterDetails';
import {ordinaryPrepared,spellIsReady} from '../src/core/spellWorkspace';

it('reuses the current render evaluation for preparation without evaluating once per spell or changing manual values',()=>{
 const c=newCharacter(),entry=(id:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>({id,name:id,english:id,kind,raw,source:'XPHB',edition:'2024',packId:'authored-render-snapshot',revision:'1',entries:['Authored preparation fixture.']});
 c.abilities.int=16;c.notes='keep manual notes';c.runtime.resources.manual={max:7,current:2};
 c.selections.push({id:'caster',entry:entry('Authored Caster','class',{casterProgression:'full',spellcastingAbility:'int',preparedSpells:'<$level$> + <$int_mod$>'}),level:2,quantity:1,equipped:false});
 for(let i=0;i<7;i++)c.selections.push({id:'spell-'+i,entry:entry('spell-'+i,'spell',{level:1,_spellClasses:{XPHB:{'Authored Caster':true}}}),level:1,quantity:1,equipped:false});
 c.spellSettings={...spellState(c),prepared:c.selections.slice(1).map(row=>row.id),capacityAdjustment:1,attackBonus:2,dcBonus:3};
 const before=structuredClone(c),derived=engine.evaluate(c),expected=spellState(c),evaluate=vi.spyOn(engine,'evaluate');
 try{
  const settings=spellState(c,derived);expect(settings).toEqual(expected);expect(settings.capacity).toBe(6);
  expect(ordinaryPrepared(c,settings)).toEqual(c.spellSettings.prepared);
  expect(c.selections.slice(1).map(row=>spellIsReady(c,row,settings))).toEqual([true,true,true,true,true,true,false]);
  expect(spellValues(c,derived)).toEqual({attack:7,dc:16});expect(evaluate).not.toHaveBeenCalled();expect(c).toEqual(before);
 }finally{evaluate.mockRestore();}
 // Each later render recomputes from its own character, including in-place
 // edits. No character-identity or source-identity cache may keep old values.
 c.abilities.int=10;c.selections[0].level=1;
 const next=engine.evaluate(c),settings=spellState(c,next);expect(settings).toEqual(spellState(c));expect(settings.capacity).toBe(2);
 expect(c.selections.slice(1).map(row=>spellIsReady(c,row,settings))).toEqual([true,true,false,false,false,false,false]);
 expect(c.runtime.resources.manual).toEqual({max:7,current:2});expect(c.notes).toBe('keep manual notes');
});
