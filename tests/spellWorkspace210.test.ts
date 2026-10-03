import {planClassMigration} from '../src/core/classMigration';
import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {type Character,type Entry} from '../src/core/model';
import {spellState} from '../src/core/characterDetails';
import {prepareSpellEntry,spellLibrary} from '../src/core/spells';
import {cantripGroups,chooseCantrip,clearCantrip,spellIsReady,ordinaryPrepared} from '../src/core/spellWorkspace';
import {casterProfiles,hasKnownLibrary} from '../src/core/spellcastingRules';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';
import {validateCharacter} from '../src/core/validation';
import {exportOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {hydrateImportedCasting} from '../src/core/castingSnapshot';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>(irFixture({id,name:id,english:id,kind,raw,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创软件验收资料。']}));
const spell=(id:string,level=1,cls='Source Mage')=>entry(id,'spell',{level,_spellClasses:{XPHB:{[cls]:true}}});
const add=(c:Character,e:Entry,id=e.id)=>{const row={id,entry:e,quantity:1,level:1,equipped:false};c.selections.push(row);return row;};
function setup(){const c=newCharacter();add(c,entry('Source Mage','class',{casterProgression:'full',spellcastingAbility:'int',cantripProgression:[2],preparedSpellsProgression:[2],spellsKnownProgressionFixed:[6]}));c.spellSettings=spellState(c);return c;}
describe('one prepared workspace with independent source, cantrip and ordinary groups',()=>{
 it('explicitly adjusts only one class learned-cantrip capacity, preserving slots and prior choices',()=>{
  const c=setup();chooseCantrip(c,spell('One',0));chooseCantrip(c,spell('Two',0));
  c.spellSettings!.slots={'1':{max:2,used:1}};c.runtime.resources['spell-slot:1']={max:2,current:1};
  (c.spellSettings as any).cantripCapacityAdjustments={'Source Mage':1};
  expect(cantripGroups(c)[0].capacity).toBe(3);expect(chooseCantrip(c,spell('Three',0)).error).toBeUndefined();
  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(cantripGroups(restored)[0].slots.filter(Boolean)).toHaveLength(3);
  (restored.spellSettings as any).cantripCapacityAdjustments={'Source Mage':-1};
  expect(cantripGroups(restored)[0].slots.filter(Boolean)).toHaveLength(3);expect(cantripGroups(restored)[0].capacity).toBe(1);
  expect(chooseCantrip(restored,spell('Four',0)).error).toContain('已满');expect(restored.spellSettings!.slots).toEqual({'1':{max:2,used:1}});expect(restored.runtime.resources['spell-slot:1']).toEqual({max:2,current:1});
 });
 it('does not let stale cantrip or extra-spell IDs consume ordinary preparation capacity',()=>{
  const c=setup(),cantrip=add(c,spell('Light',0)),extra=add(c,spell('Gift')),a=add(c,spell('A'));setSpecialSpell(c,extra.id,{mode:'uses',max:2,recovery:'long'});changeSpecialSpellUses(c,extra.id,1);
  c.spellSettings!.prepared=[cantrip.id,extra.id,a.id];expect(ordinaryPrepared(c).filter(Boolean)).toEqual([a.id]);
  const b=prepareSpellEntry(c,spell('B'));expect(b).toBeTruthy();expect(ordinaryPrepared(c).filter(Boolean)).toHaveLength(2);expect(c.runtime.resources[specialSpellResource(extra.id,c)].current).toBe(1);
 });
 it('prepares an ordinary copy of an extra spell without stripping its free uses',()=>{
  const c=setup(),e=spell('Same identity'),extra=add(c,e,'extra');setSpecialSpell(c,extra.id,{mode:'uses',max:1,recovery:'long'});changeSpecialSpellUses(c,extra.id,0);
  const normal=prepareSpellEntry(c,e);expect(normal).toBeTruthy();expect(normal).not.toBe(extra.id);expect(c.selections.filter(s=>s.entry.id===e.id)).toHaveLength(2);expect(c.runtime.resources[specialSpellResource(extra.id,c)].current).toBe(0);
 });
 it('allows an explicit occupied-slot replacement at capacity and preserves the old learned spell',()=>{
  const c=setup(),a=prepareSpellEntry(c,spell('A')),b=prepareSpellEntry(c,spell('B'));expect(prepareSpellEntry(c,spell('C'))).toBeUndefined();const replacement=prepareSpellEntry(c,spell('C'),0);
  expect(c.spellSettings!.prepared).toEqual([replacement,b]);expect(c.selections.some(s=>s.id===a)).toBe(true);expect(prepareSpellEntry(c,spell('C'))).toBe(replacement);
 });
 it('projects the full matching cantrip list without learning it or all leveled wizard spells',()=>{
  const c=setup(),before=JSON.stringify(c),catalog=[spell('One',0),spell('Two',0),spell('Unrecorded',1),spell('Wrong class',0,'Other')];
  expect(spellLibrary(c,catalog).map(s=>s.entry.name)).toEqual(['One','Two']);expect(JSON.stringify(c)).toBe(before);expect(hasKnownLibrary(casterProfiles(c)[0])).toBe(true);
 });
 it('replaces one cantrip without preparing all candidates, survives import and keeps the overview/export consistent',()=>{
  const c=setup(),a=chooseCantrip(c,spell('One',0),'Source Mage',0).id!,b=chooseCantrip(c,spell('Two',0),'Source Mage',1).id!;
  const next=chooseCantrip(c,spell('Three',0),'Source Mage',0).id!;expect(cantripGroups(c)[0].slots).toEqual([next,b]);expect(spellIsReady(c,c.selections.find(s=>s.id===a)!)).toBe(false);
  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(cantripGroups(restored)[0].slots).toEqual([next,b]);expect(exportOwlbear(restored,evaluate(restored)).spellcasting.cantrips_known.map(s=>s.name)).toEqual(['Two','Three']);
  clearCantrip(restored,'Source Mage',0);expect(cantripGroups(restored)[0].slots).toEqual(['',b]);expect(restored.selections.some(s=>s.id===next)).toBe(true);
 });
 it('keeps multiclass cantrip choices in their own groups and rejects the wrong class without mutation',()=>{
  const c=setup();add(c,entry('Other','class',{casterProgression:'full',spellcastingAbility:'cha',cantripProgression:[1],spellsKnownProgression:[2]}));
  const a=chooseCantrip(c,spell('One',0),'Source Mage',0).id!,b=chooseCantrip(c,spell('Other spell',0,'Other'),'Other',0).id!;
  expect(cantripGroups(c).map(g=>g.slots.filter(Boolean))).toEqual([[a],[b]]);const before=JSON.stringify(c);expect(chooseCantrip(c,spell('Wrong',0,'Other'),'Source Mage',1).error).toContain('法表');expect(JSON.stringify(c)).toBe(before);
 });
 it('shows a source-shaped artificer library and hides a learned-only caster library without name branching',()=>{
  const c=newCharacter();add(c,entry('Renamed crafter','class',{casterProgression:'artificer',spellcastingAbility:'int',cantripProgression:[2],preparedSpellsProgression:[2],preparedSpellsChange:'restLong'}));
  expect(hasKnownLibrary(casterProfiles(c)[0])).toBe(true);expect(spellLibrary(c,[spell('Tool spark',0,'Renamed crafter')])).toHaveLength(1);
  c.selections[0].entry.raw={casterProgression:'full',spellcastingAbility:'cha',cantripProgression:[2],spellsKnownProgression:[2]};Object.assign(c.selections[0].entry,irFixture(c.selections[0].entry));expect(hasKnownLibrary(casterProfiles(c)[0])).toBe(false);
 });
 it('validates cantrip allocations and retains legacy selections until an explicit edit',()=>{
  const c=setup();const row=add(c,spell('Legacy cantrip',0));const before=JSON.stringify(c);expect(cantripGroups(c)[0].slots).toEqual([row.id]);expect(JSON.stringify(c)).toBe(before);
  c.spellSettings!.cantrips={'Source Mage':[row.id,row.id]};expect(()=>validateCharacter(c)).toThrow(/戏法格/);
 });
 it('explicit review adopts cantrip IR while retaining an independently recorded casting override',()=>{
  const c=setup(),source=structuredClone(c.selections[0].entry),imported=c.selections[0].entry;imported.packId='imported';imported.source='IMPORTED';delete imported.raw.cantripProgression;imported.raw._castingSource={id:source.id,source:source.source};Object.assign(imported,irFixture(imported));imported.raw.spellcastingAbility='cha';Object.assign(imported,irFixture(imported));
  const before=structuredClone(c);expect(hydrateImportedCasting(c,[source])).toBe(false);expect(c).toEqual(before);c.spellSettings={...spellState(c),ability:'cha',abilityOverride:true};Object.assign(c,planClassMigration(c,[source],{[c.selections[0].id]:source.id},{id:'reviewed-cantrips',now:'2026-10-03T00:00:00Z'}).card);expect(cantripGroups(c)[0].capacity).toBe(2);expect(spellState(c).ability).toBe('cha');expect(hydrateImportedCasting(c,[source])).toBe(false);
  delete imported.raw.cantripProgression;expect(hydrateImportedCasting(c,[{...source,id:'different-identity'}])).toBe(false);
 });
});
