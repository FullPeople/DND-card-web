import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter,normalizeFixtureData as normalizeData} from './helpers/irFixture';
import {reviewCoreSamples,readReviewedClass} from './helpers/reviewedCoreSamples';
import {it,expect,vi} from 'vitest';
// Rendering is read-only; isolate the live room transport from this Node test.
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:vi.fn()}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4'}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SpellsPage} from '../src/ui/SpellsPage';
import {evaluate} from '../src/core/engine';
import {readFileSync} from 'node:fs';
import {type Character,type Edition,type Entry} from '../src/core/model';
import {bookRitualGroups,bookRitualPaymentId} from '../src/core/bookRituals';
import {newAutomationState} from '../src/core/automation/state';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {learnActiveSpell,spellIsReady} from '../src/core/spellWorkspace';
import {spellState} from '../src/core/characterDetails';
import {setPreparedSpell} from '../src/core/spells';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';

import {readCharacter} from '../src/core/validation';

const clause='你可以施展自己法术书里标记为仪式的法术。这个仪式用法不需要准备该法术。';
const entry=(id:string,source:string,kind:Entry['kind'],raw:Entry['raw']={},entries:unknown[]=[]):Entry=>(irFixture({id,name:id,english:id,kind,source,edition:source==='PHB'?'2014':'2024',packId:'fixture',revision:'1',raw,entries}));
function setup(edition:Edition='2024'){
 const c=newCharacter(edition),source=edition==='2014'?'PHB':'XPHB';c.automation=newAutomationState();
 const feature=irFixture(entry('原创书内仪式资格',source,'feature',{className:'Renamed Scholar',classSource:source,level:1},edition==='2014'?[{type:'entries',name:'原创嵌套规则',entries:[clause]}]:[clause]),{classModel:{ritualAccess:'book'}});
 const owner=entry('Renamed Scholar',source,'class',{hd:{faces:6},casterProgression:'full',spellcastingAbility:'int',spellsKnownProgressionFixed:[6],preparedSpellsProgression:[4],classFeatures:[`${feature.name}|Renamed Scholar|${source}|1|${source}`]});
 c.selections=[{id:'owner',entry:owner,level:1,quantity:1,equipped:false},{id:'feature',entry:feature,parentId:'owner',level:1,quantity:1,equipped:false}];
 const ritual=entry('原创书内法术',source,'spell',{level:1,meta:{ritual:true},classes:{fromClassList:[{name:owner.name,source}]}},['原创测试法术。']);
 const ordinary=irFixture({...ritual,id:'ordinary',name:'原创非仪式',english:'Original Ordinary',raw:{...ritual.raw,meta:{}}}),outside={...ritual,id:'outside',name:'原创书外仪式'};
 const learned=learnActiveSpell(c,ritual,'owner'),normal=learnActiveSpell(c,ordinary,'owner');syncAutoResources(c);
 return {c,ritual,ordinary,outside,id:learned.id!,normal:normal.id!};
}
it.each(['2014','2024'] as const)('projects %s book rituals without preparation, duplicates, or render mutations',edition=>{
 const {c,id,normal}=setup(edition),before=JSON.stringify(c),group=bookRitualGroups(c)[0];expect(group.source?.id).toBe('feature');expect(group.spells.map(s=>s.id)).toEqual([id]);expect(group.spells.some(s=>s.id===normal)).toBe(false);expect(spellIsReady(c,c.selections.find(s=>s.id===id)!)).toBe(false);expect(spellState(c).prepared).toEqual([]);expect(JSON.stringify(c)).toBe(before);
});
it('ritual actions preserve slots, preparation and book rows; ordinary cast and upcast are not granted',()=>{
 const {c,id,normal}=setup();setPreparedSpell(c,normal,true,2);c.runtime.resources['spell-slot:1'].current=0;
 const before={selections:structuredClone(c.selections),settings:structuredClone(c.spellSettings),resources:structuredClone(c.runtime.resources)},offer=spellPayments(c,id);expect(offer.options.map(o=>o.id)).toEqual([bookRitualPaymentId('owner')]);expect(offer.options[0]).toMatchObject({level:1,cost:0,available:true});expect(offer.options[0].label).toContain('10 分钟');
 for(const payment of ['slot:spell-slot:1','slot:spell-slot:9','free']){const unchanged=JSON.stringify(c);expect(performSpellAction(c,spellActionRequest(c,id,payment,payment)).status).toBe('rejected');expect(JSON.stringify(c)).toBe(unchanged);}
 const request=spellActionRequest(c,id,bookRitualPaymentId('owner'),'ritual-once');expect(performSpellAction(c,request).status).toBe('applied');expect(performSpellAction(c,request).status).toBe('duplicate');expect(c.selections).toEqual(before.selections);expect(c.spellSettings).toEqual(before.settings);expect(c.runtime.resources).toEqual(before.resources);expect(c.runtime.sourceSpellSpent).toBeUndefined();
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(restored.runtime.automationActions).toEqual(c.runtime.automationActions);expect(bookRitualGroups(restored)[0].spells.map(s=>s.id)).toEqual([id]);expect(restored.spellSettings).toEqual(before.settings);
});
it('rejects book-external, non-ritual, wrong-class and no-longer-allocated records',()=>{
 const {c,id,normal,outside}=setup();c.selections.push({id:'outside',entry:outside,level:1,quantity:1,equipped:false});
 for(const target of [normal,'outside','missing'])expect(spellPayments(c,target).options).toEqual([]);
 c.spellSettings!.classSpells!.owner=[];expect(bookRitualGroups(c)[0].spells).toEqual([]);expect(spellPayments(c,id).options).toEqual([]);
});
it.each(['absent','missing-text','unknown-custom','unknown-source','source-disabled','not-declared','not-owned','options','mention-only','book-only','prepared-required','negated','split-sections','split-strings','unrelated-cantrip'] as const)('requires a reviewed IR declaration for %s ritual capability',variant=>{
 const {c,id}=setup(),feature=c.selections[1];
 if(variant==='absent')c.selections.splice(1,1);
 if(variant==='missing-text')feature.entry.entries=[];
 if(variant==='unknown-custom')c.selections[0].entry.raw._custom=true;Object.assign(c.selections[0].entry,irFixture(c.selections[0].entry));
 if(variant==='unknown-source'){c.selections[0].entry.source='HOME';c.profile.enabledSources.push('HOME');}
 if(variant==='source-disabled')c.profile.disabledEntries=[feature.entry.id];
 if(variant==='not-declared')c.selections[0].entry.raw.classFeatures=[];Object.assign(c.selections[0].entry,irFixture(c.selections[0].entry));
 if(variant==='not-owned')feature.parentId='missing-owner';
 if(variant==='options')feature.entry.entries=[{type:'options',entries:[{type:'entries',entries:[clause]}]}];
 if(variant==='mention-only')feature.entry.entries=['本规则提及法术书、仪式与准备。'];
 if(variant==='book-only')feature.entry.entries=['你可以记录法术书；你不需要准备书目。'];
 if(variant==='prepared-required')feature.entry.entries=['你可以施展法术书里的仪式，但必须准备该法术。'];
 if(variant==='negated')feature.entry.entries=['你不能施展法术书中的仪式，即使不需要准备。'];
 if(variant==='split-strings')feature.entry.entries=['你可以从法术书施展仪式。','戏法无需预备。'];
 if(variant==='unrelated-cantrip')feature.entry.entries=['你可以从法术书施展仪式。戏法不需要准备。'];
 if(variant==='split-sections')feature.entry.entries=[{type:'entries',entries:['你可以从法术书施展仪式。']},{type:'entries',entries:['戏法不需要准备。']}];
 if(['unknown-custom','unknown-source'].includes(variant))feature.entry=irFixture(feature.entry);
 if(!['absent','source-disabled','not-declared','not-owned','unknown-custom','unknown-source'].includes(variant))feature.entry=irFixture(feature.entry);
 expect(bookRitualGroups(c)[0]).toMatchObject({spells:[],reason:expect.stringContaining('需核对')});expect(spellPayments(c,id).options).toEqual([]);const before=JSON.stringify(c);expect(performSpellAction(c,spellActionRequest(c,id,bookRitualPaymentId('owner'),'invalid')).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
});
it('does not borrow a ritual exception from another owned class or an inactive automation',()=>{
 const {c,id}=setup(),other=structuredClone(c.selections[0]);other.id='other';other.entry.id='other-class';other.entry.name=other.entry.english='Other Scholar';other.entry=irFixture(other.entry);c.selections.push(other);c.selections[1].parentId='other';expect(bookRitualGroups(c)[0].spells).toEqual([]);expect(spellPayments(c,id).options).toEqual([]);
 const ready=setup();ready.c.automation!.enabled=false;expect(spellPayments(ready.c,ready.id).options).toEqual([]);
});
const external=process.env.DND_BOOK_RITUAL_DATA;
it.skipIf(!external)('recognizes both actual publicly served class snapshots without publishing them',()=>{
 const catalog=reviewCoreSamples(normalizeData(readReviewedClass(external!),'external'));
 for(const edition of ['2014','2024'] as const){const c:Character=newCharacter(edition),source=edition==='2014'?'PHB':'XPHB',owner=catalog.find(e=>e.kind==='class'&&e.source===source)!;c.automation=newAutomationState();c.selections=[{id:'owner',entry:owner,level:1,quantity:1,equipped:false}];syncFeatures(c,catalog);expect(bookRitualGroups(c)[0].source?.entry.source).toBe(source);}
});


it('projects legacy known ritual rows without creating stored preparation or allocation records',()=>{
 const {c,id}=setup();delete c.spellSettings!.classSpells;const before=JSON.stringify(c);
 expect(bookRitualGroups(c)[0].spells.map(row=>row.id)).toEqual([id]);expect(c.spellSettings!.prepared).toEqual([]);expect(JSON.stringify(c)).toBe(before);
});

it('renders the ritual projection as a prepared-spell subsection rather than a separate sheet frame',()=>{
 const {c}=setup(),before=JSON.stringify(c);const html=renderToStaticMarkup(createElement(SpellsPage,{c,d:evaluate(c),edit:()=>{},browse:()=>{},inspect:()=>{},onLink:()=>{},add:()=>{}}));
 expect(html).toContain('prepared-spell-group book-ritual-grouping');expect(html).toContain('aria-label="来自仪式施法"');expect(html).not.toContain('book-ritual-cell');
 expect(html.indexOf('预备法术')).toBeLessThan(html.indexOf('来自仪式施法'));expect(html.indexOf('来自仪式施法')).toBeLessThan(html.indexOf('已知法术'));expect(JSON.stringify(c)).toBe(before);
});

it('uses reviewed ritual IR even if translated prose changes or is absent',()=>{const {c,id}=setup();c.selections[1].entry.entries=[];expect(bookRitualGroups(c)[0].spells.map(row=>row.id)).toEqual([id]);c.selections[1].entry.entries=['你不能施展任何仪式。'];expect(bookRitualGroups(c)[0].spells.map(row=>row.id)).toEqual([id]);});
