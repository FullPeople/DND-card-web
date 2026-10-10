import {describe,it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const catalog=normalizeData({
 class:[{name:'原创职业',source:'XPHB',featProgression:[{name:'原创四级选择',category:['G'],progression:{4:1}}]}],
 background:[{name:'原创背景',source:'FRHoF',feats:[{'原创起源|FRHoF':true}]}],
 feat:[{name:'原创起源',ENG_name:'Authored Origin',source:'FRHoF',category:'O'},
  {name:'原创后续',source:'FRHoF',category:'G',prerequisite:[{level:4,feat:['原创起源|FRHoF']}]},
  {name:'原创起源',source:'XPHB',category:'O'}]
},'feat-prerequisite-fixture');
function setup(){
 const c=newCharacter();c.automation=newAutomationState();c.profile.enabledSources=['XPHB','FRHOF'];
 c.selections=catalog.filter(e=>['class','background'].includes(e.kind)).map(e=>({id:`owner-${e.kind}`,entry:e,level:e.kind==='class'?4:1,quantity:1,equipped:false}));
 syncFeatures(c,catalog);return c;
}
const target=catalog.find(e=>e.name==='原创后续')!;
const option=(c:ReturnType<typeof setup>)=>sheetChoices(c,catalog).find(r=>r.sourceProgression==='feat')!.options.find(o=>o.value===target.id)!;
describe('source-qualified feat prerequisites',()=>{
 it('accepts an active background origin grant and preserves the later choice across native save and reload',()=>{
  const c=setup();expect(c.selections.some(s=>s.entry.name==='原创起源'&&s.parentId==='owner-background')).toBe(true);
  expect(option(c).unavailable).toBeUndefined();const choice=sheetChoices(c,catalog).find(r=>r.sourceProgression==='feat')!;
  setSheetChoiceSlot(c,choice.id,0,target.id,catalog);syncChoiceContent(c,catalog);
  const restored=validateCharacter(exportCharacter(c));syncFeatures(restored,catalog);
  expect(sheetChoices(restored,catalog).find(r=>r.id===choice.id)?.selected).toEqual([target.id]);
  expect(restored.selections.filter(s=>s.entry.id===target.id)).toHaveLength(1);
 });
 it('rejects a matching name from another source and never mutates a rejected choice',()=>{
  const c=setup();c.selections=c.selections.filter(s=>s.entry.kind!=='background'&&s.entry.kind!=='feat');
  c.selections.push({id:'wrong-source',entry:catalog.find(e=>e.name==='原创起源'&&e.source==='XPHB')!,level:1,quantity:1,equipped:false});
  expect(option(c).unavailable).toBeDefined();const before=structuredClone(c),choice=sheetChoices(c,catalog).find(r=>r.sourceProgression==='feat')!;
  expect(()=>setSheetChoiceSlot(c,choice.id,0,target.id,catalog)).toThrow();expect(c).toEqual(before);
 });
 it.each(['disabled-feat','disabled-parent','missing-parent','wrong-edition','cyclic-parent'] as const)('rejects %s prerequisite evidence',mode=>{
  const c=setup(),grant=c.selections.find(s=>s.entry.kind==='feat')!;
  if(mode==='disabled-feat')c.profile.disabledEntries=[grant.entry.id];
  if(mode==='disabled-parent')c.profile.disabledEntries=[c.selections.find(s=>s.id===grant.parentId)!.entry.id];
  if(mode==='missing-parent')c.selections=c.selections.filter(s=>s.id!==grant.parentId);
  if(mode==='wrong-edition')grant.entry={...grant.entry,edition:'2014'};
  if(mode==='cyclic-parent')grant.parentId=grant.id;
  expect(option(c).unavailable).toBeDefined();
 });
 it('still enforces the level and leaves unsupported prerequisite shapes unavailable',()=>{
  const c=setup();c.selections.find(s=>s.entry.kind==='class')!.level=3;
  const choice=sheetChoices(c,catalog).find(r=>r.sourceProgression==='feat');expect(choice).toBeUndefined();
  c.selections.find(s=>s.entry.kind==='class')!.level=4;
  const invalid={...target,raw:{...target.raw,prerequisite:[{feat:[]}]}};
  expect(sheetChoices(c,[...catalog.filter(e=>e.id!==target.id),invalid]).find(r=>r.sourceProgression==='feat')!.options.find(o=>o.value===target.id)!.unavailable).toBeDefined();
 });
 it('treats multiple typed feat prerequisites as alternatives while retaining the other conditions',()=>{
  const c=setup(),alternative={...target,raw:{...target.raw,prerequisite:[{level:4,feat:['原创未拥有|FRHoF','Authored Origin|frhof']}]}};
  expect(sheetChoices(c,[...catalog.filter(e=>e.id!==target.id),alternative]).find(r=>r.sourceProgression==='feat')!.options.find(o=>o.value===target.id)!.unavailable).toBeUndefined();
 });
});

const cache=process.env.DND_FEAT_PREREQUISITE_CACHE;
it.skipIf(!cache)('uses the stored Harper background and Harper Teamwork prerequisite without a name-specific implementation',()=>{
 const index=JSON.parse(readFileSync(join(cache!,'index.json'),'utf8'));
 const data:Record<string,unknown[]>={};
 for(const row of index.rows.filter((r:{url:string})=>/\/(?:feats\.json|backgrounds\.json|class\/class-fighter\.json)$/.test(r.url))){
  for(const [kind,items] of Object.entries(JSON.parse(readFileSync(join(cache!,row.path),'utf8'))))if(Array.isArray(items))data[kind]=[...(data[kind]||[]),...items];
 }
 const entries=normalizeData(data,'external-feat-prerequisite'),c=newCharacter();c.automation=newAutomationState();
 c.profile.enabledSources=[...new Set(entries.map(e=>e.source))];
 const classEntry=entries.find(e=>e.kind==='class'&&e.english==='Fighter'&&e.source==='XPHB')!;
 const background=entries.find(e=>e.kind==='background'&&e.english==='Harper'&&e.source==='FRHOF')!;
 const later=entries.find(e=>e.kind==='feat'&&e.english==='Harper Teamwork'&&e.source==='FRHOF')!;
 expect(classEntry).toBeDefined();expect(background).toBeDefined();expect(later).toBeDefined();
 c.selections=[{id:'real-class',entry:classEntry,level:4,quantity:1,equipped:false},{id:'real-background',entry:background,level:1,quantity:1,equipped:false}];
 syncFeatures(c,entries);const choice=sheetChoices(c,entries).find(r=>r.sourceProgression==='feat'&&r.options.some(o=>o.value===later.id))!;
 expect(choice.options.find(o=>o.value===later.id)?.unavailable).toBeUndefined();
 setSheetChoiceSlot(c,choice.id,0,later.id,entries);syncChoiceContent(c,entries);
 expect(c.selections.some(s=>s.entry.id===later.id)).toBe(true);
});
