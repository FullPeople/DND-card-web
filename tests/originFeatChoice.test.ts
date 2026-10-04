import {describe,it,expect} from 'vitest';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption,choiceSource} from '../src/core/automation/choices';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
import {choiceCatalog,choiceEntryMatcher} from '../src/ui/choiceCatalog';
import {originFeatData} from './fixtures/originFeatChoice';
import {readFileSync} from 'node:fs';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';

const catalog=normalizeData(originFeatData,'fixture-origin-feat');
function originFeatCharacter(){const c=newCharacter();c.name='起源专长验收';c.automation=newAutomationState();c.selections=[{id:'origin-race',entry:structuredClone(catalog.find(e=>e.kind==='race')!),level:1,quantity:1,equipped:false}];syncFeatures(c,catalog);return c;}

const feat=(name:string,source='XPHB')=>catalog.find(e=>e.kind==='feat'&&e.name===name&&e.source===source)!;
const choice=(c=originFeatCharacter(),entries=catalog)=>sheetChoices(c,entries).find(r=>r.label==='起源选择验收')!;
describe('declared origin feat filters',()=>{
 it('matches lowercase filter metadata to uppercase category codes on the source bubble',()=>{
  const c=originFeatCharacter(),r=choice(c);expect(r.ownerId).toBe('origin-race:trait:0');expect(r.count).toBe(1);
  expect(r.options.map(o=>o.entry.name)).toEqual(['验收警觉','验收艺能']);
  const scope=choiceCatalog(c,r,catalog);expect(scope.wiki).toBe(true);expect(scope.tab).toBe('feat');expect(scope.entries.map(e=>e.name)).toEqual(['验收警觉','验收艺能']);
  expect(choiceEntryMatcher(c,r)(feat('验收通用'))).toBeUndefined();expect(choiceEntryMatcher(c,r)(feat('验收警觉','PHB'))).toBeUndefined();
 });
 it('persists one owned grant, makes repeated drops inert, replaces and clears only its descendants',()=>{
  const c=originFeatCharacter(),r=choice(c),picked=feat('验收艺能');setSheetChoiceSlot(c,r.id,0,picked.id,catalog);syncFeatures(c,catalog);
  const granted=c.selections.find(s=>s.entry.id===picked.id)!;expect(granted).toMatchObject({parentId:r.ownerId,requirementId:r.id});expect(granted.grantKey).toBe(`choice:${r.id}:${picked.id}`);
  const nested=sheetChoices(c,catalog).find(r=>r.ownerId===granted.id)!;expect(choiceSource(c,nested)).toBe('origin-race');setSheetChoiceSlot(c,nested.id,0,'athletics',catalog);
  for(let n=0;n<4;n++){setSheetChoiceSlot(c,r.id,0,picked.id,catalog);syncFeatures(c,catalog);}expect(c.selections.filter(s=>s.entry.id===picked.id)).toHaveLength(1);
  const restored=validateCharacter(exportCharacter(c));syncFeatures(restored,catalog);expect(restored.answers[nested.id][0]).toBe('athletics');expect(restored.selections.find(s=>s.id===granted.id)).toEqual(granted);
  const before=structuredClone(restored);expect(()=>setSheetChoiceSlot(restored,r.id,1,feat('验收警觉').id,catalog)).toThrow();expect(()=>chooseSheetOption(restored,r.id,feat('验收通用').id,catalog)).toThrow();expect(restored).toEqual(before);
  setSheetChoiceSlot(restored,r.id,0,feat('验收警觉').id,catalog);syncFeatures(restored,catalog);expect(restored.selections.some(s=>s.id===granted.id)).toBe(false);expect(choice(restored).selected).toEqual([feat('验收警觉').id]);
  setSheetChoiceSlot(restored,r.id,0,undefined,catalog);syncFeatures(restored,catalog);expect(restored.selections.filter(s=>s.entry.kind==='feat')).toHaveLength(0);expect(choice(restored).complete).toBe(false);
  removeSelection(restored,'origin-race');syncFeatures(restored,catalog);expect(restored.selections).toHaveLength(0);
 });
 it('keeps strict edition/category boundaries, source restrictions and duplicate ownership',()=>{
  const c=originFeatCharacter();c.profile.optional.legacy=true;
  c.selections.push({id:'independent-feat',entry:feat('验收警觉'),level:1,quantity:1,equipped:false});
  let r=choice(c);expect(r.options).toHaveLength(2);expect(r.options.find(o=>o.entry.id===feat('验收警觉').id)?.unavailable).toContain('已经在角色卡');
  const before=structuredClone(c);expect(()=>setSheetChoiceSlot(c,r.id,0,feat('验收警觉').id,catalog)).toThrow(/已经在角色卡/);expect(c).toEqual(before);
  setSheetChoiceSlot(c,r.id,0,feat('验收艺能').id,catalog);syncFeatures(c,catalog);r=choice(c);expect(r.options).toHaveLength(2);expect(r.options.find(o=>o.entry.id===feat('验收艺能').id)?.unavailable).toBeUndefined();
  c.profile.disabledEntries=[feat('验收艺能').id];r=choice(c);expect(r.selected).toEqual([feat('验收艺能').id]);expect(r.options.find(o=>o.entry.id===feat('验收艺能').id)?.unavailable).toContain('单独禁用');
  c.profile.enabledSources=[];syncFeatures(c,catalog);expect(choice(c).restricted).toBe(true);expect(c.selections.some(s=>s.entry.id===feat('验收艺能').id)).toBe(true);
  c.profile.enabledSources=['XPHB'];c.profile.disabledEntries=[];syncFeatures(c,catalog);expect(choice(c).selected).toEqual([feat('验收艺能').id]);
 });
 it('retains a feat drop slot while candidates load and recovers saved grants from snapshots',()=>{
  const c=originFeatCharacter(),empty=choice(c,[]);expect(empty.options).toHaveLength(0);expect(choiceCatalog(c,empty,[])).toMatchObject({wiki:true,tab:'feat',entries:[]});
  const r=choice(c);setSheetChoiceSlot(c,r.id,0,feat('验收警觉').id,catalog);syncFeatures(c,catalog);
  const restored=validateCharacter(exportCharacter(c));syncFeatures(restored,[]);expect(choice(restored,[]).selected).toEqual([feat('验收警觉').id]);expect(restored.selections.filter(s=>s.entry.kind==='feat')).toHaveLength(1);
  syncFeatures(restored,catalog);expect(choice(restored).options).toHaveLength(2);
 });
 it('keeps the saved feat snapshot ahead of newer catalog copies with the same identity',()=>{
  const c=originFeatCharacter(),r=choice(c),picked=feat('验收警觉');setSheetChoiceSlot(c,r.id,0,picked.id,catalog);syncFeatures(c,catalog);
  const owned=c.selections.find(s=>s.entry.id===picked.id)!.entry,changed=catalog.map(e=>e.id===picked.id?{...e,name:'较新目录名称',entries:['较新目录正文']}:e);
  const option=choice(c,changed).options.find(o=>o.value===picked.id)!;expect(option.entry).toBe(owned);expect(option.label).toBe('验收警觉');expect(choice(c,changed).options.filter(o=>o.value===picked.id)).toHaveLength(1);
 });
 it('preserves the button-list fallback for custom origin feats that are not Wiki identities',()=>{
  const c=originFeatCharacter(),custom={...feat('验收警觉'),id:'authored-origin',name:'自定义起源',source:'CUSTOM',packId:'custom',edition:'both' as const,raw:{category:'O',_custom:true}},entries=[...catalog,custom],r=choice(c,entries);
  expect(r.options.find(o=>o.value===custom.id)?.unavailable).toBeUndefined();expect(choiceCatalog(c,r,entries).wiki).toBe(false);
  chooseSheetOption(c,r.id,custom.id,entries);syncFeatures(c,entries);expect(c.selections.filter(s=>s.entry.id===custom.id)).toHaveLength(1);
 });
});

const realData=process.env.DND_ORIGIN_FEAT_DATA;
it.skipIf(!realData)('uses real Human XPHB metadata and keeps all normalized origin identities',()=>{
 const entries=normalizeData({...JSON.parse(readFileSync(`${realData}/races.json`,'utf8')),...JSON.parse(readFileSync(`${realData}/feats.json`,'utf8'))},'external-origin-probe');
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'real-human',entry:entries.find(e=>e.kind==='race'&&e.english==='Human'&&e.source==='XPHB')!,quantity:1,level:1,equipped:false}];
 syncFeatures(c,entries);const r=sheetChoices(c,entries).find(r=>r.ownerId==='real-human:trait:2'&&r.channel==='content')!;
 expect(r.id).toBe('real-human:trait:2:filter:0');expect(r.count).toBe(1);expect(r.options.filter(o=>o.entry.source==='XPHB')).toHaveLength(13);expect(r.options.every(o=>o.entry.raw.category==='O'&&o.entry.source!=='PHB')).toBe(true);
 const alert=r.options.find(o=>o.entry.english==='Alert'&&o.entry.source==='XPHB')!;setSheetChoiceSlot(c,r.id,0,alert.value,entries);syncFeatures(c,entries);expect(c.selections.filter(s=>s.entry.id===alert.value)).toHaveLength(1);
});
