import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {spellState} from '../src/core/characterDetails';
import {availableClassSpells,casterProfiles,spellUsesPreparation} from '../src/core/spellcastingRules';
import {spellLibrary,prepareSpellEntry,setPreparedSpell} from '../src/core/spells';
import {validateCharacter} from '../src/core/validation';
const entry=(kind:Entry['kind'],name:string,raw:Entry['raw']={},source='XPHB'):Entry=>({id:`${source}:${kind}:${name}`,name,english:name,kind,raw,source,edition:'both',packId:'test',revision:'1',entries:['正文']});
const add=(c:Character,e:Entry,level=3)=>{const row={id:e.id,entry:e,level,quantity:1,equipped:false};c.selections.push(row);return row;};
const caster=(c:Character,name:string,raw:Entry['raw'],source='XPHB')=>add(c,entry('class',name,{spellcastingAbility:'wis',casterProgression:'full',...raw},source));
const spell=(name:string,level:number,cls:string,source='XPHB')=>entry('spell',name,{level,_spellClasses:{[source]:{[cls]:true}}},source);

describe('source-declared spell preparation',()=>{
 it('distinguishes 2024 level-replacement casters from daily preparers despite the shared Prepared label',()=>{
  for(const name of ['Bard','Sorcerer','Warlock']){const c=newCharacter();caster(c,name,{preparedSpellsProgression:[4,5,6],preparedSpellsChange:'level'});expect(spellState(c).mode).toBe('known');expect(casterProfiles(c)[0].pool).toBe('learned');}
  for(const name of ['Cleric','Druid','Paladin','Ranger']){const c=newCharacter();caster(c,name,{preparedSpellsProgression:[4,5,6],preparedSpellsChange:'restLong'});expect(spellState(c).mode).toBe('prepared');expect(casterProfiles(c)[0].pool).toBe('list');}
 });
 it('keeps the wizard spellbook distinct from the cleric full list, without name-based branching',()=>{
  const c=newCharacter();caster(c,'Whatever Translation',{preparedSpells:'<$level$> + <$int_mod$>',spellsKnownProgressionFixed:[6,2,2]});
  expect(casterProfiles(c)[0].pool).toBe('book');expect(availableClassSpells(c,[spell('Book spell',1,'Whatever Translation')])).toEqual([]);
  const s=add(c,spell('Recorded spell',1,'Whatever Translation'));expect(prepareSpellEntry(c,s.entry)).toBe(s.id);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(1);
 });
 it('2014 known casters remain known, and explicit manual overrides survive changing class metadata',()=>{
  const c=newCharacter('2014');caster(c,'Bard',{spellsKnownProgression:[4,5,6]},'PHB');expect(spellState(c).mode).toBe('known');
  c.spellSettings={...spellState(c),mode:'prepared',modeOverride:true};expect(spellState(c).mode).toBe('prepared');expect(validateCharacter(c).spellSettings?.modeOverride).toBe(true);
 });
 it('projects enabled class-list spells through the class level, not a multiclass slot total',()=>{
  const c=newCharacter();caster(c,'Cleric',{preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6]});
  const catalog=[spell('First',1,'Cleric'),spell('Second',2,'Cleric'),spell('Third',3,'Cleric'),spell('Wrong',1,'Wizard'),{...spell('Disabled',1,'Cleric'),source:'TCE'}];
  c.runtime.resources['spell-slot:9']={current:1,max:1};expect(availableClassSpells(c,catalog).map(e=>e.name)).toEqual(['First','Second']);expect(c.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(0);
 });
 it('preparation stores one identity and returns it to the library on removal; a full pool cannot mint a spell',()=>{
  const c=newCharacter();caster(c,'Cleric',{preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6]});const a=spell('First',1,'Cleric'),b=spell('Second',2,'Cleric');c.spellSettings={...spellState(c),capacity:1};delete c.spellSettings.capacityAdjustment;
  const id=prepareSpellEntry(c,a)!;expect(id).toBeTruthy();expect(spellLibrary(c,[a,b]).filter(s=>s.entry.id===a.id)).toHaveLength(1);expect(prepareSpellEntry(c,b)).toBeUndefined();expect(c.selections.some(s=>s.entry.id===b.id)).toBe(false);
  expect(setPreparedSpell(c,id,false)).toBe(true);expect(c.selections.find(s=>s.id===id)?.entry.id).toBe(a.id);expect(prepareSpellEntry(c,a)).toBe(id);expect(c.selections.filter(s=>s.entry.id===a.id)).toHaveLength(1);
 });
 it('does not make learned-only multiclass spells use the daily preparation pool',()=>{
  const c=newCharacter();caster(c,'Bard',{preparedSpellsChange:'level',preparedSpellsProgression:[4,5,6]});caster(c,'Cleric',{preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6]});expect(spellUsesPreparation(c,spell('Song',1,'Bard'))).toBe(false);expect(spellUsesPreparation(c,spell('Prayer',1,'Cleric'))).toBe(true);
 });
 it('accepts any visible empty preparation slot when no explicit capacity is set',()=>{
  const c=newCharacter(),e=spell('Flexible slot',1,'Cleric');add(c,e);const id=prepareSpellEntry(c,e,4)!;
  expect(spellState(c).prepared).toEqual(['','','','',id]);
 });
 it('uses legacy expansion class lookups with the same revised PHB class without conflating identities',()=>{
  const c=newCharacter();caster(c,'Cleric',{preparedSpellsChange:'restLong',preparedSpellsProgression:[4,5,6]});c.profile.enabledSources.push('TCE');
  const shared={...spell('Expansion prayer',1,'Cleric','PHB'),id:'tce:prayer',source:'TCE'},other={...spell('Other class',1,'Wizard','PHB'),id:'tce:other',source:'TCE'};
  expect(availableClassSpells(c,[shared,other]).map(e=>e.id)).toEqual(['tce:prayer']);
  expect(availableClassSpells(c,[spell('Core legacy prayer',1,'Cleric','PHB')])).toEqual([]);
 });
});
