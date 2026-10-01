import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry,type Edition} from '../src/core/model';
import {suggestedMigrationTarget,migrationCandidates} from '../src/core/cardMigration';
const entry=(source:string,id=source,patch:Partial<Entry>={}):Entry=>({id,kind:'race',name:'原创旅人',english:'Original Traveller',source,packId:'fixture',edition:source.startsWith('X')?'2024':source==='PHB'?'2014':'both',revision:'1',entries:['原创验收资料'],raw:{},...patch});
function fixture(edition:Edition='2024'){
 const c=newCharacter(edition);c.profile.enabledSources=['PHB','DMG','MM','XPHB','XDMG','XMM','EXP-A','EXP-B'];
 const old=entry('IMPORTED','old',{packId:'imported',edition:'both'}),row={id:'old-row',entry:old,quantity:1,level:1,equipped:false};c.selections=[row];
 return {c,row,entries:[entry('EXP-A'),entry('EXP-B'),entry('PHB'),entry('XPHB'),entry('XDMG')]};
}
describe('migration recommendations prefer the active edition core handbooks',()=>{
 it.each(['2014','2024'] as const)('recommends the %s player handbook among homonyms without changing the card',edition=>{
  const {c,row,entries}=fixture(edition),before=structuredClone(c),candidates=migrationCandidates(c,row,entries);
  expect(suggestedMigrationTarget(c,candidates,row.entry)).toBe(edition==='2024'?'XPHB':'PHB');expect(c).toEqual(before);
 });
 it('uses another enabled core book and does not recommend disabled, excluded or other-edition entries',()=>{
  const {c,row,entries}=fixture();c.profile.enabledSources=c.profile.enabledSources.filter(s=>s!=='XPHB');c.profile.optional.legacy=true;
  expect(suggestedMigrationTarget(c,entries,row.entry)).toBe('XDMG');c.profile.disabledEntries=['XDMG'];expect(suggestedMigrationTarget(c,entries,row.entry)).toBe('');
  expect(suggestedMigrationTarget(c,[entry('MM')],row.entry)).toBe('');
 });
 it('preserves an already linked exact entry, without confusing pack or source identity',()=>{
  const {c,entries}=fixture(),current=entries[0];expect(suggestedMigrationTarget(c,entries,current)).toBe('EXP-A');
  expect(suggestedMigrationTarget(c,entries,{...current,packId:'other'})).toBe('XPHB');
 });
 it('does not guess between duplicate preferred-book identities or multiple expansions',()=>{
  const {c,row}=fixture();expect(suggestedMigrationTarget(c,[entry('XPHB','one'),entry('XPHB','two')],row.entry)).toBe('');
  expect(suggestedMigrationTarget(c,[entry('EXP-A'),entry('EXP-B')],row.entry)).toBe('');expect(suggestedMigrationTarget(c,[entry('EXP-B')],row.entry)).toBe('EXP-B');
 });
});
