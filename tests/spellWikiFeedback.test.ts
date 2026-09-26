import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {matchesEntrySearch} from '../src/core/search';
import {createCustomEntry,CUSTOM_TYPES} from '../src/core/customEntries';
import {customEntryExample,customCreationPrompt,parseCustomEntryJson,validateCustomFields} from '../src/core/customEntrySchema';
import {setSpecialSpell,specialSpellResource,changeSpecialSpellUses} from '../src/core/specialSpells';
import {setPreparedSpell} from '../src/core/spells';
import {spellUsesPreparation} from '../src/core/spellcastingRules';
import {syncAutoResources} from '../src/core/resources';
import {removeSelection} from '../src/core/sheet';
import {validateCharacter} from '../src/core/validation';
import {normalizeData} from '../src/data/catalog';
import {WEAPON_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {trainingCategory} from '../src/ui/trainingData';
import {compareEntries,columnsFor} from '../src/ui/libraryData';
const entry=(name:string,kind:Entry['kind']='spell',raw:Entry['raw']={}):Entry=>({id:name,kind,name,english:'',raw:{level:1,...raw},entries:[],source:'XPHB',edition:'2024',revision:'1',packId:'fixture'});
describe('spell and Wiki feedback',()=>{
 it('matches full pinyin, initials, accented/spaced pinyin, Chinese and English without matching unrelated names',()=>{
  const spell=entry('火球术');spell.english='Fireball';
  for(const query of ['huoqiushu','hqs','huo qiu','huǒ qiú','火球','fire','XPHB'])expect(matchesEntrySearch(spell,query)).toBe(true);
  expect(matchesEntrySearch(spell,'zhiliao')).toBe(false);
 });
 it('keeps source sorting authoritative for supplemental statuses',()=>{
  const extra=entry('专注','condition',{_category:'status'}),core=entry('扩展状态','condition',{_category:'condition'});core.source='TCE';
  expect(compareEntries(extra,core,columnsFor('condition').find(c=>c.key==='source')!,false)).toBeLessThan(0);
 });
 it('provides two independently identified weapon proficiency categories in both editions',()=>{
  expect(WEAPON_TRAINING_ENTRIES).toHaveLength(4);expect(new Set(WEAPON_TRAINING_ENTRIES.map(e=>e.id)).size).toBe(4);
  expect(WEAPON_TRAINING_ENTRIES.every(e=>trainingCategory(e)==='weapons')).toBe(true);
 });
 it('preserves 2024 class equipment entries and renders declared starting skills without automatically granting choices',()=>{
  const [cls]=normalizeData({class:[{name:'测试职业',source:'XPHB',startingProficiencies:{weapons:['simple'],skills:[{choose:{from:['arcana','history'],count:1}}]},startingEquipment:{entries:['选择 {@item 测试武器|XPHB} 或金币。'],defaultData:[{A:[{value:100}]}]}}]},'1');
  const text=JSON.stringify(cls.entries);expect(text).toContain('起始熟练项');expect(text).toContain('奥秘、历史');expect(text).toContain('简易武器');expect(text).toContain('{@item 测试武器|XPHB}');expect(text.match(/起始装备/g)).toHaveLength(1);
 });
 it('validates all authored formats and preserves nested linked content and weapon choices through edits',()=>{
  for(const type of Object.keys(CUSTOM_TYPES)){const example=customEntryExample(type),parsed=parseCustomEntryJson(JSON.stringify(example));expect(parsed.raw._customType).toBe(type);expect(parsed.entries).toEqual(example.entries);}
  const template=customEntryExample('weapon');template.raw.weaponCategory='martial';template.raw.type='R';const parsed=parseCustomEntryJson(JSON.stringify(template));expect(parsed.raw).toMatchObject({type:'R',weaponCategory:'martial'});
  const edited=createCustomEntry({name:parsed.name,type:'weapon',body:parsed.entries.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n\n'),raw:parsed.raw});expect(edited.entries).toEqual(parsed.entries);
  expect(()=>validateCustomFields('class',{hd:{faces:8}})).toThrow('豁免');expect(()=>validateCustomFields('spell',{level:1})).toThrow('学派');expect(()=>validateCustomFields('item',{weight:0})).toThrow('价格');
  expect(()=>parseCustomEntryJson('{"name":"x","entries":[],"__proto__":{}}')).toThrow();expect(customCreationPrompt('spell')).toContain('{@spell');
  expect(()=>parseCustomEntryJson('{"name":"x","type":"unknown","entries":["正文"],"raw":{}}')).toThrow('不支持');
 });
 it('moves prepared spells to locked/limited sections, preserves expenditure on refresh and native import, and cleans removed references',()=>{
  const c=newCharacter(),spell=entry('每日星光');c.selections.push({id:'s',entry:spell,level:1,quantity:1,equipped:false});c.spellSettings={mode:'prepared',modeOverride:true,ability:'int',capacity:2,capacityAdjustment:2,attackBonus:0,dcBonus:0,prepared:['s'],slots:{}};
  setSpecialSpell(c,'s',{mode:'uses',max:2,recovery:'long'});expect(c.spellSettings.prepared).toEqual(['']);expect(spellUsesPreparation(c,spell)).toBe(false);expect(setPreparedSpell(c,'s',true)).toBe(false);
  changeSpecialSpellUses(c,'s',1);syncAutoResources(c);const loaded=validateCharacter(JSON.parse(JSON.stringify(c)));expect(loaded.runtime.resources[specialSpellResource('s')].current).toBe(1);
  setSpecialSpell(loaded,'s',{mode:'uses',max:3});expect(loaded.runtime.resources[specialSpellResource('s')].current).toBe(2);
  removeSelection(loaded,'s');expect(loaded.spellSettings?.special).toEqual({});expect(loaded.runtime.resources[specialSpellResource('s')]).toBeUndefined();
  setSpecialSpell(c,'s',{mode:'locked'});expect(c.runtime.resources[specialSpellResource('s')]).toBeUndefined();expect(spellUsesPreparation(c,spell)).toBe(false);
  setSpecialSpell(c,'s');expect(spellUsesPreparation(c,spell)).toBe(true);expect(setPreparedSpell(c,'s',true)).toBe(true);
  c.spellSettings.special={absent:{mode:'locked'}};expect(()=>validateCharacter(c)).toThrow('固定与次数');
 });
});
