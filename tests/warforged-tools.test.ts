import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {normalizeData} from '../src/data/catalog';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {choiceCatalog,choiceEntryMatcher} from '../src/ui/choiceCatalog';
import source from './fixtures/warforged-tool-sources.json';
import {warforgedToolEntries} from './helpers/warforgedToolFixture';
const catalog=normalizeData(source.projection,'mechanical-projection');
it('the browser projection uses the actual normalizer identities and editions',()=>{
 expect(warforgedToolEntries().map(e=>[e.id,e.kind,e.source,e.edition,e.raw.type])).toEqual(catalog.map(e=>[e.id,e.kind,e.source,e.edition,e.raw.type]));
});
function setup(book:'ERLW'|'EFA'){
 const c=newCharacter(book==='ERLW'?'2014':'2024');c.automation=newAutomationState();c.profile.enabledSources.push(book);c.training={tools:'玩家手工工具记录',languages:'玩家手工语言'};c.runtime.resources={spent:{current:1,max:4}};c.runtime.hp=7;
 c.selections=[{id:'race',entry:structuredClone(catalog.find(e=>e.kind==='race'&&e.source===book)!),quantity:1,level:1,equipped:false}];return c;
}
for(const book of ['ERLW','EFA'] as const){
 it(`${book} real Warforged exposes separate skill and tool slots with live tool identities`,()=>{
  const c=setup(book),before=JSON.stringify(c),choices=sheetChoices(c,catalog),skill=choices.find(r=>r.channel==='skills')!,tool=choices.find(r=>r.channel==='tools')!;
  expect(skill.count).toBe(1);expect(skill.options).toHaveLength(18);expect(tool.count).toBe(1);expect(tool.selected).toEqual([]);expect(tool.options.length).toBeGreaterThan(0);
  const scope=choiceCatalog(c,tool,catalog);expect(scope.wiki).toBe(true);expect(scope.tab).toBe('item');expect(scope.entries.map(e=>e.name)).toEqual(['炼金工具','风笛']);expect(JSON.stringify(c)).toBe(before);
 });
 it(`${book} tool selection replaces/removes atomically and preserves manual records and consumed resources`,()=>{
  const c=setup(book),id=sheetChoices(c,catalog).find(r=>r.channel==='tools')!.id,tools=catalog.filter(e=>e.kind==='item'&&e.source===(c.edition==='2014'?'PHB':'XPHB'));
  setSheetChoiceSlot(c,id,0,tools[0].id,catalog);expect(sheetChoices(c,catalog).find(r=>r.id===id)!.selected).toEqual([tools[0].id]);
  setSheetChoiceSlot(c,id,0,tools[1].id,catalog);expect(c.answers[id]).toEqual([tools[1].id]);setSheetChoiceSlot(c,id,0,undefined,catalog);expect(c.answers[id]).toEqual(['']);
  expect(c.training).toEqual({tools:'玩家手工工具记录',languages:'玩家手工语言'});expect(c.runtime.resources.spent.current).toBe(1);expect(c.runtime.hp).toBe(7);expect(c.selections).toHaveLength(1);
 });
 it(`${book} empty tool catalogs keep a waiting slot and reject unrelated candidates without writing`,()=>{
  const c=setup(book),tool=sheetChoices(c,[]).find(r=>r.channel==='tools')!,before=JSON.stringify(c),scope=choiceCatalog(c,tool,[]);
  expect(scope.wiki).toBe(true);expect(scope.tab).toBe('item');expect(scope.entries).toEqual([]);expect(choiceEntryMatcher(c,tool)(catalog.find(e=>e.kind==='race')!)).toBeUndefined();expect(()=>setSheetChoiceSlot(c,tool.id,0,'unverified-tool',[])).toThrow();expect(JSON.stringify(c)).toBe(before);
 });
}
it('the tool choice applies to other authored sources and accepts only declared tool types',()=>{
 const c=setup('EFA');c.selections[0].entry={...c.selections[0].entry,id:'authored-choice',name:'原创通用工具选择',english:'Authored Tool Choice',kind:'feat'};
 const entry=(id:string,type:string):Entry=>({id,kind:'item',name:id,english:id,source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{type}});
 const items=['AT','T','INS','GS','VEH','S','unknown'].map(type=>entry(type,type)),tool=sheetChoices(c,items).find(r=>r.channel==='tools')!;
 expect(tool.options.map(o=>o.value)).toEqual(['AT','T','INS','GS']);const scope=choiceCatalog(c,tool,items);expect(scope.wiki).toBe(true);expect(scope.entries.map(e=>e.id)).toEqual(['AT','T','INS','GS']);
});
