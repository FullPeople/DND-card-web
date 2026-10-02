import {it,expect} from 'vitest';
import {classRulesEdition,classEditionSuffix} from '../src/core/classEdition';
import {newCharacter,type Entry,type Edition} from '../src/core/model';
const entry=(source:string,edition:Edition|'both',kind:Entry['kind']='class'):Entry=>({id:`fixture:${source}:${edition}`,name:'原创职业',english:'Original Class',source,edition,kind,packId:'fixture',revision:'1',entries:[],raw:{}});
const card=(...entries:Entry[])=>({...newCharacter(),selections:entries.map((entry,i)=>({id:`row${i}`,entry,level:1,quantity:1,equipped:false}))});
it.each(['2014','2024'] as const)('describes selected %s classes independently of card and Wiki filters',edition=>{
 const c=card(entry(edition==='2014'?'PHB':'XPHB',edition));c.edition=edition==='2014'?'2024':'2014';expect(classRulesEdition(c)).toBe(edition);expect(classEditionSuffix(c)).toBe(` · ${edition}`);
 c.selections.push(...card(entry('EXTRA',edition)).selections);expect(classEditionSuffix(c)).toBe(` · ${edition}`);
});
it('does not invent an edition for no class, unknown or mixed classes',()=>{
 for(const c of [card(),card(entry('PHB','2014','race')),card(entry('CUSTOM','both')),card(entry('PHB','2014'),entry('CUSTOM','both')),card(entry('PHB','2014'),entry('XPHB','2024'))]){expect(classRulesEdition(c)).toBeUndefined();expect(classEditionSuffix(c)).toBe('');}
});
it('uses existing core rule provenance even when a stale snapshot edition disagrees',()=>{
 expect(classEditionSuffix(card(entry('PHB','2024')))).toBe(' · 2014');expect(classEditionSuffix(card(entry('XPHB','2014')))).toBe(' · 2024');
});
