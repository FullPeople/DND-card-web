import {describe,it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {sourceChoicePrerequisite} from '../src/core/automation/sourceClassChoices';
import {entryDragPage} from '../src/ui/entryDragIntent';
import {dropRejection} from '../src/ui/dropRejection';
import {validateCharacter} from '../src/core/validation';

// Authored prose using the actual upstream progression/category shapes inspected
// at the 251 baseline. No source text, player record or item activation fixture.
function fixture(source:string,level:number,raw:Record<string,unknown>){
 const entries=normalizeData({class:[{name:'原创成长职业',ENG_name:'Authored Progression Class',source,entries:[],...raw}],
  feat:[{name:'原创风格',ENG_name:'Authored Style',source:'XPHB',category:'FS',entries:['原创选择。']}],
  optionalfeature:[{name:'原创注法',ENG_name:'Authored Infusion',source:'TCE',featureType:['AI'],entries:['原创选项，不生成物品。']},
   {name:'原创祈唤',ENG_name:'Authored Invocation',source:'XPHB',featureType:['EI'],entries:['原创选项，不执行未验证机制。']}]},'fixture-class-level');
 const c=newCharacter();c.edition=source==='XPHB'?'2024':'2014';c.profile.enabledSources=[source];c.profile.optional.feats=true;c.automation=newAutomationState();
 c.selections=[{id:'class-owner',entry:entries.find(e=>e.kind==='class')!,level,quantity:1,equipped:false}];
 return {c,entries};
}
describe('class-level entry regressions at 251',()=>{
 it('offers a source-declared feat progression in the feat choice channel at its class level',()=>{
  const {c,entries}=fixture('XPHB',1,{featProgression:[{name:'原创风格授予',category:['FS'],progression:{'1':1}}]});
  const choice=sheetChoices(c,entries).find(r=>r.ownerId==='class-owner'&&r.catalogKind==='feat');
  expect(choice,'declared class feat progression must create a real selection entry').toBeDefined();
  expect(choice!.count).toBe(1);expect(choice!.options.map(o=>o.entry.raw.category)).toEqual(['FS']);
 });
 it('offers four learned legacy infusions at Artificer-source class level 2, without treating them as items',()=>{
  const {c,entries}=fixture('TCE',2,{optionalfeatureProgression:[{name:'原创注法选择',featureType:['AI'],progression:[0,4]}]});
  const choice=sheetChoices(c,entries).find(r=>r.ownerId==='class-owner'&&r.options.some(o=>o.entry.raw.featureType?.includes('AI')));
  expect(choice,'optionalfeatureProgression AI must create a source-owned choice').toBeDefined();
  expect(choice!.count).toBe(4);expect(choice!.options.every(o=>o.entry.kind==='feature')).toBe(true);
 });
 it('offers three updated invocations at Warlock-source class level 2',()=>{
  const {c,entries}=fixture('XPHB',2,{optionalfeatureProgression:[{name:'原创祈唤选择',featureType:['EI'],progression:[1,3]}]});
  const choice=sheetChoices(c,entries).find(r=>r.ownerId==='class-owner'&&r.options.some(o=>o.entry.raw.featureType?.includes('EI')));
  expect(choice,'optionalfeatureProgression EI must create a source-owned choice').toBeDefined();expect(choice!.count).toBe(3);
 });
 it.each(['AI','EI'])('guides a typed optional feature %s drag to the feature sheet while preserving choice-workspace pages',type=>{
  const {entries}=fixture(type==='AI'?'TCE':'XPHB',2,{}),entry=entries.find(e=>e.raw.featureType?.includes(type))!;
  expect(entry.kind).toBe('feature');expect(entry.raw._category).toBe('optionalfeature');
  expect(entryDragPage(entry,'entry')).toBe('特性');expect(entryDragPage(entry,'entry',true)).toBeUndefined();
 });
 it('already accepts the typed infusion at an enabled generic feature target, separating receiver from missing entry routing',()=>{
  const {c,entries}=fixture('TCE',2,{}),entry=entries.find(e=>e.raw.featureType?.includes('AI'))!;
  expect(dropRejection(c,entry,{kinds:['feature','rule']})).toBeUndefined();
 });
});

describe('source-owned records and boundaries',()=>{
 it('retains learned snapshots, source-disabled slots and overflow without granting mechanisms',()=>{
  const {c,entries}=fixture('XPHB',2,{optionalfeatureProgression:[{name:'原创学习',featureType:['ei'],progression:[1,3]}]});
  const choice=sheetChoices(c,entries).find(r=>r.sourceProgression==='optional')!,entry=entries.find(e=>e.raw.featureType?.includes('EI'))!;
  const resources=JSON.stringify(c.runtime),manual=JSON.stringify(c.abilities);
  setSheetChoiceSlot(c,choice.id,2,entry.id,entries);syncChoiceContent(c,entries);
  expect(c.selections).toHaveLength(1);expect(JSON.stringify(c.runtime)).toBe(resources);expect(JSON.stringify(c.abilities)).toBe(manual);
  expect(sheetChoices(c,[]).find(r=>r.id===choice.id)!.options.some(o=>o.value===entry.id)).toBe(true);
  expect(validateCharacter(JSON.parse(JSON.stringify(c))).classChoiceSnapshots?.[entry.id].id).toBe(entry.id);
  c.selections[0].level=1;c.profile.enabledSources=[];
  const retained=sheetChoices(c,[]).find(r=>r.id===choice.id)!;
  expect(retained.slots).toEqual(['','',entry.id]);expect(retained.selected).toEqual([]);expect(c.answers[choice.id]).toEqual(['','',entry.id]);
 });
 it('does not require an infusion target item merely to record learning',()=>{
  const {c,entries}=fixture('TCE',2,{}),entry=entries.find(e=>e.raw.featureType?.includes('AI'))!;
  entry.raw.prerequisite=[{item:['原创物品条件']}];
  expect(sourceChoicePrerequisite(c,entry,c.selections[0],true)).toBeUndefined();
 });
 it('creates independent typed general-feat grants at class levels, rather than total level',()=>{
  const {c,entries}=fixture('XPHB',4,{classFeatures:['原创提升|原创成长职业|XPHB|4','原创提升|原创成长职业|XPHB|6']});
  entries.push(...normalizeData({feat:[{name:'原创提升专长',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:['str','dex'],amount:2}}],prerequisite:[{level:4}],entries:[]}],classFeature:[4,6].map(level=>({name:'原创提升',source:'XPHB',className:'原创成长职业',classSource:'XPHB',level,entries:['{@feat 原创提升专长|XPHB}']}))},'fixture-typed-grant'));
  expect(sheetChoices(c,entries).filter(r=>r.sourceProgression==='feat')).toHaveLength(1);
  c.selections.push({...c.selections[0],id:'other-class',entry:{...c.selections[0].entry,id:'other-class-entry',raw:{}},level:2});
  expect(sheetChoices(c,entries).filter(r=>r.sourceProgression==='feat')).toHaveLength(1);
  c.selections[0].level=6;const choices=sheetChoices(c,entries).filter(r=>r.sourceProgression==='feat');expect(choices).toHaveLength(2);expect(choices[0].id).not.toBe(choices[1].id);
  const feat=entries.find(entry=>entry.kind==='feat'&&entry.raw.repeatable===true)!;
  for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
  syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.id===feat.id)).toHaveLength(2);
  const saved=JSON.stringify(c.answers),abilities=JSON.stringify(c.abilities),resources=JSON.stringify(c.runtime);
  c.selections[0].level=4;syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.id===feat.id)).toHaveLength(1);expect(JSON.stringify(c.answers)).toBe(saved);
  c.selections[0].level=6;syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.id===feat.id)).toHaveLength(2);expect(JSON.stringify(c.abilities)).toBe(abilities);expect(JSON.stringify(c.runtime)).toBe(resources);
 });
 it('does not synthesize legacy infusions for a plan-based class without optional progression',()=>{
  const {c,entries}=fixture('EFA',2,{});expect(sheetChoices(c,entries).filter(r=>r.sourceProgression==='optional')).toEqual([]);
 });
 it('shows untyped legacy feat references as pending without granting an executable choice',()=>{
  const {c,entries}=fixture('PHB',4,{classFeatures:['原创旧版提升|原创成长职业|PHB|4']});
  entries.push(...normalizeData({classFeature:[{name:'原创旧版提升',source:'PHB',className:'原创成长职业',classSource:'PHB',level:4,entries:['{@5etools 原创目录|feats.html}']}]},'legacy-reference'));
  const choices=sheetChoices(c,entries).filter(row=>row.sourceProgression==='feat');expect(choices).toHaveLength(1);expect(choices[0].count).toBe(0);expect(choices[0].options).toEqual([]);
  expect(()=>setSheetChoiceSlot(c,choices[0].id,0,'invented',entries)).toThrow();expect(c.selections).toHaveLength(1);
 });
 it('keeps unknown prerequisites unavailable and uses optional class level, not total level',()=>{
  const {c,entries}=fixture('XPHB',2,{}),entry=entries.find(e=>e.raw.featureType?.includes('EI'))!;
  c.selections.push({...c.selections[0],id:'other-class',level:10});entry.raw.prerequisite=[{level:3}];
  expect(sourceChoicePrerequisite(c,entry,c.selections[0],true)).toContain('等级 3');
  entry.raw.prerequisite=[{spell:[{choose:'unverified'}]}];expect(sourceChoicePrerequisite(c,entry,c.selections[0],true)).toContain('手动核对');
 });
 it('allows another eligible feat at 2024 class 19 and retains its record after downgrade',()=>{
  const {c,entries}=fixture('XPHB',18,{featProgression:[{name:'原创高阶授予',category:['EB'],progression:{'19':1}}]});
  expect(sheetChoices(c,entries).filter(row=>row.sourceProgression==='feat')).toEqual([]);
  c.selections[0].level=19;const choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='feat')!;
  expect(choice.options.some(option=>option.entry.raw.category==='FS')).toBe(true);
  setSheetChoiceSlot(c,choice.id,0,choice.options[0].value,entries);syncChoiceContent(c,entries);
  c.selections[0].level=18;syncChoiceContent(c,entries);const stored=sheetChoices(c,entries).find(row=>row.id===choice.id)!;
  expect(stored.count).toBe(0);expect(stored.slots).toEqual([choice.options[0].value]);expect(stored.selected).toEqual([]);
 });
});
