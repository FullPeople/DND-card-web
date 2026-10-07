import {describe,expect,it,vi} from 'vitest';
vi.mock('../src/ui/SheetEdit',async()=>({SheetEditContext:(await import('react')).createContext(false)}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
vi.mock('../src/platform/workbench',()=>({inWorkbench:false,workbenchRequest:()=>Promise.resolve(),composeRoll:()=>{}}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {EQUIPMENT_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {equipmentTraining} from '../src/core/proficiencyText';
import {trainingDisplayText} from '../src/ui/trainingReferences';
import {trainingChipReference} from '../src/core/trainingChipReference';
import {trainingDeclarations} from '../src/core/automation/training';
import {activeSelections} from '../src/core/automation/active';
import {newAutomationState} from '../src/core/automation/state';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {TrainingChips} from '../src/ui/TrainingChips';
import {ReferenceContext} from '../src/ui/Reference';
import {source,shieldTrainingEntries} from './helpers/shieldTrainingFixture';

function card(edition:'2014'|'2024'):Character{
 const c=newCharacter(edition);c.automation=newAutomationState();c.abilities.dex=10;c.training={tools:'手工工具',languages:'手工语言'};c.runtime.hp=7;c.runtime.resources={manual:{current:1,max:4}};
 c.selections=shieldTrainingEntries().filter(e=>e.edition===edition).map(entry=>({id:entry.kind==='class'?'class':'shield',entry,level:1,quantity:1,equipped:entry.kind==='item'}));return c;
}
const collisions:Entry[]=['2014','2024'].flatMap(edition=>{
 const source=edition==='2014'?'PHB':'XPHB';return ['item','spell','rule'].map((kind,i)=>({id:'authored-collision:'+edition+':'+i,kind:kind as Entry['kind'],name:'盾牌',english:'Shield',source,edition:edition as '2014'|'2024',packId:'authored',revision:'1',entries:['原创同名类型隔离夹具'],raw:{_category:kind==='rule'?'itemType':kind,type:kind==='item'?'S':undefined}}));
});
const catalog=[...collisions,...EQUIPMENT_TRAINING_ENTRIES];
const resolve=(ref:string,kind?:string)=>ref.startsWith('entry:')?catalog.find(e=>e.id===ref.slice(6)):catalog.find(e=>(!kind||e.kind===(kind==='itemProperty'?'rule':kind))&&[e.name,e.english].some(name=>name.toLowerCase()===ref.split('|')[0].toLowerCase())&&e.source.toLowerCase()===ref.split('|')[1]?.toLowerCase());

it('connects the four mechanical projections to actual normalization and real shield declarations',()=>{
 const normalized=normalizeData(source.projection,'verified-mechanical-projection'),entries=shieldTrainingEntries();
 expect(normalized.map(e=>[e.id,e.kind,e.edition,e.raw.type])).toEqual(entries.map(e=>[e.id,e.kind,e.edition,e.raw.type]));
 for(const row of source.projection.class){expect(row.startingProficiencies.armor).toEqual(['light','medium','heavy','shield']);expect(row.multiclassing.proficienciesGained.armor).toEqual(['light','medium','shield']);}
});
for(const edition of ['2014','2024'] as const)describe(`${edition} shield declaration binding`,()=>{
 const book=edition==='2014'?'PHB':'XPHB';
 it.each(['shield','Shield','SHIELD','shields','Shields','SHIELDS','盾牌'])('keeps %s a training category from declaration through display and explicit save',alias=>{
  const c=card(edition);c.selections[0].entry.raw.startingProficiencies.armor=['light',alias];expect(evaluate(c).ac).toBe(12);
  const display=trainingDisplayText(alias,book,'armor',collisions.filter(e=>e.kind==='item'));
  expect(display).toBe(`{@itemProperty 盾牌|${book}}`);const chip=trainingChipReference(display,'item',resolve,{group:'armor',source:book});
  expect(chip.entry?.id).toBe(`dnd-card.weapon-training:${edition}:shield`);expect(chip.entry?.raw._trainingCategory).toBe('armor');expect(chip.entry?.raw._category).toBe('itemProperty');
  c.training!.armor=display;expect(evaluate(c).ac).toBe(12);const before=JSON.stringify(c);expect(evaluate(c).ac).toBe(12);expect(JSON.stringify(c)).toBe(before);
  const restored=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;expect(restored.training).toEqual(c.training);expect(restored.runtime).toEqual(c.runtime);expect(evaluate(restored).ac).toBe(12);
 });
 it('binds manual bare aliases and typed category aliases without changing source, caption or stored text',()=>{
  for(const raw of ['sHiElD',`{@itemProperty Shield|${book.toLowerCase()}|玩家标签}`]){
   const c=card(edition);c.training!.armor=raw;const before=JSON.stringify(c),chip=trainingChipReference(raw,'item',resolve,{group:'armor',source:book});
   expect(chip.entry?.id).toBe(`dnd-card.weapon-training:${edition}:shield`);expect(evaluate(c).ac).toBe(12);expect(JSON.stringify(c)).toBe(before);expect(c.training!.armor).toBe(raw);
   if(raw.includes('玩家标签')){expect(chip.label).toBe('玩家标签');expect(chip.reference).toBe(`Shield|${book.toLowerCase()}|玩家标签`);}
  }
  const unknown=trainingChipReference('{@itemProperty Shield|HOME|保留未知来源}','item',resolve,{group:'armor',source:book});expect(unknown.reference).toBe('Shield|HOME|保留未知来源');expect(unknown.entry).toBeUndefined();
 });
 it('does not turn named equipment or a Shield spell into category training',()=>{
  for(const raw of [`{@item Shield|${book}|玩家装备记录}`,`{@spell Shield|${book}|玩家法术记录}`]){
   const c=card(edition);c.training!.armor=raw;const before=JSON.stringify(c),chip=trainingChipReference(raw,'item',resolve,{group:'armor',source:book});
   expect(chip.kind).toBe(raw.includes('@spell')?'spell':'item');expect(chip.entry?.kind).toBe(chip.kind);expect(trainingDeclarations(c,activeSelections(c),'armor').some(v=>equipmentTraining(v)?.[0]==='shield')).toBe(false);
   expect(evaluate(c).ac).toBe(edition==='2014'?12:10);expect(evaluate(c).issues.some(i=>i.id==='armor-training:shield')).toBe(true);expect(JSON.stringify(c)).toBe(before);
  }
 });
 it('recomputes automatic additions/removals and honors manual empty/full overrides without restoring consumed resources',()=>{
  const c=card(edition),owner=c.selections[0];expect(evaluate(c).ac).toBe(12);c.selections=c.selections.filter(row=>row.id!=='class');expect(evaluate(c).ac).toBe(edition==='2014'?12:10);
  c.selections.unshift(owner);expect(evaluate(c).ac).toBe(12);c.profile.disabledEntries=[owner.entry.id];expect(evaluate(c).ac).toBe(edition==='2014'?12:10);c.profile.disabledEntries=[];
  c.training!.armor='';expect(evaluate(c).ac).toBe(edition==='2014'?12:10);c.training!.armor='盾牌';c.selections=c.selections.filter(row=>row.id!=='class');expect(evaluate(c).ac).toBe(12);expect(c.training!.tools).toBe('手工工具');expect(c.runtime.resources.manual.current).toBe(1);
 });
 it('keeps fixed feature grants and multiclass declarations distinct from unrelated Shield entries',()=>{
  const c=card(edition);c.selections[0].entry.raw.startingProficiencies.armor=[];
  const feature:Entry={...structuredClone(c.selections[0].entry),id:'authored-fixed-grant:'+edition,kind:'feat',raw:{armorProficiencies:[{shields:true}]},entries:[]};
  c.selections.push({id:'grant',entry:feature,level:1,quantity:1,equipped:false});expect(evaluate(c).ac).toBe(12);c.selections.pop();expect(evaluate(c).ac).toBe(edition==='2014'?12:10);
  const multi=structuredClone(c.selections[0]);multi.id='second-class';multi.entry.id+=':second';c.profile.optional.multiclass=true;c.selections.push(multi);expect(evaluate(c).ac).toBe(12);
 });
});
it('renders category handles with colliding catalog entries while preserving all manual input bytes',()=>{
 const raw='shield、{@itemProperty Shield|phb|玩家标签}、{@item Shield|PHB|装备记录}、{@spell Shield|PHB|法术记录}、手工未收录说明',writes:string[]=[];
 const html=renderToStaticMarkup(createElement(ReferenceContext.Provider,{value:{resolve,show:()=>{},move:()=>{},leave:()=>{},close:()=>{}}},createElement(TrainingChips,{group:'armor',source:'PHB',label:'护甲',value:raw,onChange:value=>writes.push(value)})));
 expect(html.match(/data-reference="itemProperty:entry:dnd-card.weapon-training:2014:shield"/g)).toHaveLength(2);expect(html).toContain('玩家标签');expect(html).toContain('data-reference="item:Shield|PHB|装备记录"');expect(html).toContain('data-reference="spell:Shield|PHB|法术记录"');expect(html).toContain('手工未收录说明');expect(writes).toEqual([]);
});
