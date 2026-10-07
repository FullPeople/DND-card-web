import {it,expect,vi} from 'vitest';
// Static markup checks use the real workspace and choice functions, with only
// unused live-room transport and pointer-event setup isolated from Node.
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:vi.fn()}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {normalizeData} from '../src/data/catalog';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {choiceCatalog,choiceEntryMatcher} from '../src/ui/choiceCatalog';
import {evaluate} from '../src/core/engine';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChoiceWorkspace} from '../src/ui/ChoiceWorkspace';
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
function explicitTools(from:string[]){
 const c=setup('EFA');
 c.selections[0].entry={...c.selections[0].entry,id:'authored-explicit-tools',name:'原创指定工具选择',english:'Authored Explicit Tools',kind:'feat',raw:{toolProficiencies:[{choose:{from,count:1}}]}};
 return c;
}
it('explicit unindexed tool concepts retain clickable selection, replacement and saved answers',()=>{
 const c=explicitTools(['Custom Tool A','Custom Tool B']),before=JSON.stringify(c),tool=sheetChoices(c,[]).find(r=>r.channel==='tools')!,scope=choiceCatalog(c,tool,[]);
 expect(tool.options.map(o=>o.value)).toEqual(['Custom Tool A','Custom Tool B']);expect(tool.options.every(o=>o.entry.raw._choiceConcept)).toBe(true);
 expect(scope.wiki).toBe(false);expect(scope.entries).toEqual([]);expect(JSON.stringify(c)).toBe(before);
 chooseSheetOption(c,tool.id,'Custom Tool A',[]);expect(c.answers[tool.id]).toEqual(['Custom Tool A']);
 const restored=JSON.parse(JSON.stringify(c));expect(sheetChoices(restored,[]).find(r=>r.id===tool.id)!.selected).toEqual(['Custom Tool A']);expect(choiceCatalog(restored,sheetChoices(restored,[]).find(r=>r.id===tool.id)!,[]).wiki).toBe(false);
 chooseSheetOption(c,tool.id,'Custom Tool B',[]);expect(c.answers[tool.id]).toEqual(['Custom Tool B']);chooseSheetOption(c,tool.id,'Custom Tool B',[]);expect(c.answers[tool.id]).toEqual([]);
 expect(c.training).toEqual({tools:'玩家手工工具记录',languages:'玩家手工语言'});expect(c.runtime.resources.spent.current).toBe(1);expect(c.runtime.hp).toBe(7);expect(c.selections).toHaveLength(1);
});
it('a mixed indexed and concept tool declaration keeps both choices available through the option list',()=>{
 const indexed=catalog.find(e=>e.kind==='item'&&e.source==='XPHB')!,c=explicitTools([indexed.id,'Custom Tool B']),tool=sheetChoices(c,[indexed]).find(r=>r.channel==='tools')!;
 expect(tool.options[0].entry).toBe(indexed);expect(tool.options[1].entry.raw._choiceConcept).toBe(true);const scope=choiceCatalog(c,tool,[indexed]);expect(scope.wiki).toBe(false);expect(scope.entries).toEqual([indexed]);
 chooseSheetOption(c,tool.id,'Custom Tool B',[indexed]);expect(c.answers[tool.id]).toEqual(['Custom Tool B']);chooseSheetOption(c,tool.id,indexed.id,[indexed]);expect(c.answers[tool.id]).toEqual([indexed.id]);
});
it('a saved unavailable tool in concept mode can be explicitly removed but cannot be selected again',()=>{
 const indexed=catalog.find(e=>e.kind==='item'&&e.source==='PHB')!,c=explicitTools([indexed.id,'Custom Tool B']);c.profile.enabledSources=['PHB','EFA'];c.profile.optional.legacy=true;
 const id=sheetChoices(c,[indexed]).find(r=>r.channel==='tools')!.id;c.answers[id]=[indexed.id];c.profile.enabledSources=['EFA'];const tool=sheetChoices(c,[indexed]).find(r=>r.id===id)!;
 expect(choiceCatalog(c,tool,[indexed]).wiki).toBe(false);expect(tool.options.find(o=>o.value===indexed.id)?.unavailable).toBeTruthy();chooseSheetOption(c,id,indexed.id,[indexed]);expect(c.answers[id]).toEqual([]);
 const before=JSON.stringify(c);expect(()=>chooseSheetOption(c,id,indexed.id,[indexed])).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('explicit fully indexed tool choices keep their genuine Wiki drag targets',()=>{
 const indexed=catalog.filter(e=>e.kind==='item'&&e.source==='XPHB'),c=explicitTools(indexed.map(e=>e.id)),tool=sheetChoices(c,indexed).find(r=>r.channel==='tools')!,scope=choiceCatalog(c,tool,indexed);
 expect(scope.wiki).toBe(true);expect(scope.tab).toBe('item');expect(scope.entries).toEqual(indexed);expect(choiceEntryMatcher(c,tool)(indexed[0])?.value).toBe(indexed[0].id);
});
function savedTools(){
 const c=setup('EFA');c.profile.enabledSources=['PHB','XPHB','EFA'];c.profile.optional.legacy=true;
 c.selections[0].entry={...c.selections[0].entry,id:'authored-two-tools',name:'原创两个工具选择',english:'Authored Two Tools',kind:'feat',raw:{toolProficiencies:[{any:2}]}};
 const a=catalog.find(e=>e.kind==='item'&&e.source==='PHB')!,b=catalog.find(e=>e.kind==='item'&&e.source==='XPHB'&&e.raw.type.startsWith('INS'))!,next=catalog.find(e=>e.kind==='item'&&e.source==='XPHB'&&e.raw.type.startsWith('AT'))!,id=sheetChoices(c,catalog).find(r=>r.channel==='tools')!.id;
 c.answers[id]=[a.id,b.id];return {c,a,b,next,id};
}
it('disabling one tool source preserves its saved slot while another slot changes and re-enabling restores eligibility',()=>{
 const {c,a,b,next,id}=savedTools();c.profile.enabledSources=c.profile.enabledSources.filter(s=>s!=='PHB');const before=JSON.stringify(c),tool=sheetChoices(c,catalog).find(r=>r.id===id)!;
 expect(tool.slots).toEqual([a.id,b.id]);expect(tool.options.find(o=>o.value===a.id)?.unavailable).toBeTruthy();expect(tool.complete).toBe(false);expect(choiceCatalog(c,tool,catalog).entries).not.toContain(a);expect(JSON.stringify(c)).toBe(before);
 expect(()=>setSheetChoiceSlot(c,id,1,a.id,catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSheetChoiceSlot(c,id,1,next.id,catalog);expect(c.answers[id]).toEqual([a.id,next.id]);
 const restored=JSON.parse(JSON.stringify(c));expect(sheetChoices(restored,catalog).find(r=>r.id===id)!.slots).toEqual([a.id,next.id]);
 c.profile.enabledSources.push('PHB');const enabled=sheetChoices(c,catalog).find(r=>r.id===id)!;expect(enabled.options.find(o=>o.value===a.id)?.unavailable).toBeUndefined();expect(enabled.complete).toBe(true);expect(choiceEntryMatcher(c,enabled)(a)?.value).toBe(a.id);expect(c.answers[id]).toEqual([a.id,next.id]);
 expect(c.training).toEqual({tools:'玩家手工工具记录',languages:'玩家手工语言'});expect(c.runtime.resources.spent.current).toBe(1);expect(c.runtime.hp).toBe(7);
});
it('wrong-edition saved tools remain recorded and become candidates only after the explicit legacy option is enabled',()=>{
 const {c,a,b,next,id}=savedTools();c.profile.optional.legacy=false;const before=JSON.stringify(c),tool=sheetChoices(c,catalog).find(r=>r.id===id)!;
 expect(tool.slots).toEqual([a.id,b.id]);expect(tool.options.find(o=>o.value===a.id)?.unavailable).toBeTruthy();expect(choiceEntryMatcher(c,tool)(a)).toBeUndefined();expect(JSON.stringify(c)).toBe(before);
 setSheetChoiceSlot(c,id,1,next.id,catalog);expect(c.answers[id]).toEqual([a.id,next.id]);c.profile.optional.legacy=true;
 const compatible=sheetChoices(c,catalog).find(r=>r.id===id)!;expect(compatible.complete).toBe(true);expect(choiceEntryMatcher(c,compatible)(a)?.value).toBe(a.id);expect(c.answers[id]).toEqual([a.id,next.id]);
});
it('missing legacy tool IDs and overflow records survive edits without invented catalog entries',()=>{
 const {c,b,next,id}=savedTools();c.answers[id]=['legacy-unindexed-tool',b.id,'legacy-extra-tool'];const before=JSON.stringify(c),tool=sheetChoices(c,catalog).find(r=>r.id===id)!;
 expect(tool.slots).toEqual(['legacy-unindexed-tool',b.id,'legacy-extra-tool']);expect(tool.options.some(o=>o.value==='legacy-unindexed-tool'||o.value==='legacy-extra-tool')).toBe(false);expect(tool.complete).toBe(false);expect(JSON.stringify(c)).toBe(before);
 setSheetChoiceSlot(c,id,1,next.id,catalog);expect(c.answers[id]).toEqual(['legacy-unindexed-tool',next.id,'legacy-extra-tool']);setSheetChoiceSlot(c,id,0,undefined,catalog);expect(c.answers[id]).toEqual(['',next.id,'legacy-extra-tool']);
});
it('concept clicks preserve untouched duplicate, missing and overflow tool records instead of rewriting from the deduplicated view',()=>{
 const c=explicitTools(['Custom Tool A','Custom Tool B','Custom Tool C']);c.selections[0].entry.raw.toolProficiencies[0].choose.count=2;const id=sheetChoices(c,[]).find(r=>r.channel==='tools')!.id;
 c.answers[id]=['Custom Tool A','Custom Tool A','Custom Tool B','legacy-missing'];chooseSheetOption(c,id,'Custom Tool B',[]);expect(c.answers[id]).toEqual(['Custom Tool A','Custom Tool A','','legacy-missing']);
 const before=JSON.stringify(c);expect(()=>chooseSheetOption(c,id,'Custom Tool C',[])).toThrow();expect(JSON.stringify(c)).toBe(before);
 setSheetChoiceSlot(c,id,0,undefined,[]);chooseSheetOption(c,id,'Custom Tool C',[]);expect(c.answers[id]).toEqual(['Custom Tool C','Custom Tool A','','legacy-missing']);
});
it('tool retention does not activate a disabled source skill or turn an unknown answer into a skill grant',()=>{
 const c=setup('EFA'),skill=sheetChoices(c,catalog).find(r=>r.channel==='skills')!;c.answers[skill.id]=['athletics'];expect(evaluate(c).skills.athletics.proficient).toBe(true);
 c.profile.enabledSources=c.profile.enabledSources.filter(s=>s!=='EFA');const before=JSON.stringify(c);expect(sheetChoices(c,catalog).find(r=>r.id===skill.id)!.restricted).toBe(true);expect(evaluate(c).skills.athletics.proficient).toBe(false);expect(JSON.stringify(c)).toBe(before);expect(c.answers[skill.id]).toEqual(['athletics']);
 c.answers[skill.id]=['legacy-unknown-skill'];expect(sheetChoices(c,catalog).find(r=>r.id===skill.id)!.selected).toEqual([]);expect(evaluate(c).skills.athletics.proficient).toBe(false);
});
const renderWorkspace=(c:ReturnType<typeof newCharacter>,id:string,entries:Entry[])=>renderToStaticMarkup(createElement(ChoiceWorkspace,{c,id,catalog:entries,edit:action=>action(c),close:()=>{}}));
it('the actual workspace renders explicit concept buttons instead of an empty Wiki drop area without mutating the card',()=>{
 const c=explicitTools(['Custom Tool A','Custom Tool B']),id=sheetChoices(c,[]).find(r=>r.channel==='tools')!.id,before=JSON.stringify(c),html=renderWorkspace(c,id,[]);
 expect(html.match(/<button[^>]*class="choice-option /g)).toHaveLength(2);expect(html).toContain('Custom Tool A');expect(html).toContain('Custom Tool B');expect(html).not.toContain('class="choice-slots"');expect(JSON.stringify(c)).toBe(before);
});
it('the actual workspace displays saved unavailable tools and offers explicit removal in both slot and concept modes',()=>{
 const {c,a,id}=savedTools();c.profile.enabledSources=c.profile.enabledSources.filter(s=>s!=='PHB');const html=renderWorkspace(c,id,catalog);expect(html).toContain('此选项来源或版本当前不可用，已有记录保留。');expect(html).toContain('已有选择当前不可用，原记录保留');expect(c.answers[id][0]).toBe(a.id);
 const custom=explicitTools(['Custom Tool A','Custom Tool B']),customId=sheetChoices(custom,[]).find(r=>r.channel==='tools')!.id;custom.answers[customId]=['legacy-unindexed-tool'];const before=JSON.stringify(custom),customHtml=renderWorkspace(custom,customId,[]);
 expect(customHtml).toContain('已有记录：legacy-unindexed-tool');expect(customHtml).toContain('aria-label="移除legacy-unindexed-tool"');expect(JSON.stringify(custom)).toBe(before);setSheetChoiceSlot(custom,customId,0,undefined,[]);expect(custom.answers[customId]).toEqual(['']);
});
