import {expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {spellState} from '../src/core/characterDetails';
import {setPreparedSpell} from '../src/core/spells';

it('drag preparation is idempotent, swaps occupied slots, and leaves learned identities intact',()=>{
 const c=newCharacter();
 for(const name of ['a','b','c']){const entry:Entry={id:name,name,english:name,kind:'spell',source:'XPHB',edition:'2024',packId:'test',revision:'1',raw:{level:1},entries:[]};c.selections.push({id:name,entry,level:1,quantity:1,equipped:false});}
 c.spellSettings={...spellState(c),mode:'prepared',capacity:2};delete c.spellSettings.capacityAdjustment;
 expect(setPreparedSpell(c,'a',true,1)).toBe(true);expect(c.spellSettings.prepared).toEqual(['','a']);
 expect(setPreparedSpell(c,'a',true)).toBe(false);
 expect(setPreparedSpell(c,'b',true,0)).toBe(true);expect(setPreparedSpell(c,'c',true,0)).toBe(false);
 expect(setPreparedSpell(c,'a',true,0)).toBe(true);expect(c.spellSettings.prepared).toEqual(['a','b']);
 expect(setPreparedSpell(c,'a',false)).toBe(true);expect(setPreparedSpell(c,'a',false)).toBe(false);
 expect(c.spellSettings.prepared).toEqual(['','b']);expect(c.selections.map(s=>s.id)).toEqual(['a','b','c']);
 c.spellSettings.mode='known';expect(setPreparedSpell(c,'a',true)).toBe(false);
});
