import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {type Character,type Entry} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {evaluate} from '../src/core/engine';
import {evaluateFeatureArmor} from '../src/core/automation/featureArmor';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setAutomationEnabled} from '../src/core/automation/state';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {equipSelection} from '../src/core/automation/equipment';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';

import {armorFeatureFixture as createFixture,sentence} from './fixtures/featureArmor';
const armorFeatureFixture=(edition:'2014'|'2024'='2024')=>createFixture(edition,normalizeData);

function select(c:Character,entries:Entry[],id:string,name='测试护甲加值'){const choice=sheetChoices(c,entries).find(r=>r.id===id)!;setSheetChoiceSlot(c,id,0,choice.options.find(o=>o.label===name)!.value,entries);syncFeatures(c,entries);}

describe('source-owned conditional armor feature effects',()=>{
 it.each(['2014','2024'] as const)('%s selected content grants one AC only while wearing body armor; reselection and removal retract it',edition=>{
  const {c,entries,choice}=armorFeatureFixture(edition);expect(evaluate(c).ac).toBe(16);select(c,entries,choice.id);expect(evaluate(c).ac).toBe(17);expect(evaluate(c).issues.some(i=>i.id.startsWith('choice-rule:'))).toBe(false);
  equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(19);equipSelection(c,'armor',false);expect(evaluate(c).ac).toBe(12);equipSelection(c,'shield',false);expect(evaluate(c).ac).toBe(10);
  equipSelection(c,'armor',true);select(c,entries,choice.id,'测试替代');expect(evaluate(c).ac).toBe(16);select(c,entries,choice.id);expect(evaluate(c).ac).toBe(17);
  setSheetChoiceSlot(c,choice.id,0,undefined,entries);syncFeatures(c,entries);expect(evaluate(c).ac).toBe(16);expect(c.selections.some(s=>s.grantKey?.startsWith('choice:'))).toBe(false);
  select(c,entries,choice.id);removeSelection(c,'class');syncFeatures(c,entries);expect(evaluate(c).ac).toBe(16);
 });
 it.each(['LA','MA','HA'])('supports %s, explicit adjustment and armor enhancement independently',type=>{
  const {c,entries,choice}=armorFeatureFixture();const armor=c.selections.find(s=>s.id==='armor')!;armor.entry.raw={...armor.entry.raw,type,ac:12,bonusAc:'+2',reqAttune:true};c.abilities.dex=16;c.sheetBonuses={ac:-1};select(c,entries,choice.id);
  expect(evaluate(c).ac).toBe(type==='LA'?15:type==='MA'?14:12);armor.attuned=true;expect(evaluate(c).ac).toBe(type==='LA'?17:type==='MA'?16:14);
 });
 it('keeps saved choice/source identity, pure reload evaluation, source/parent gating and manual opt-out',()=>{
  const {c,entries,choice}=armorFeatureFixture();select(c,entries,choice.id);c.runtime.resources={spent:{current:0,max:3}};const restored=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
  const before=JSON.stringify(restored);for(let n=0;n<5;n++){expect(evaluate(restored).ac).toBe(17);syncFeatures(restored,entries);}expect(JSON.stringify(restored)).toBe(before);
  const selected=restored.selections.find(s=>s.grantKey?.startsWith('choice:'))!;restored.profile.disabledEntries=[selected.entry.id];expect(evaluate(restored).ac).toBe(16);restored.profile.disabledEntries=[restored.selections.find(s=>s.id==='class')!.entry.id];expect(evaluate(restored).ac).toBe(16);
  restored.profile.disabledEntries=[];restored.profile.enabledSources=[];expect(evaluate(restored).ac).toBe(10);restored.profile.enabledSources=['XPHB'];expect(evaluate(restored).ac).toBe(17);setAutomationEnabled(restored,false);expect(evaluate(restored).ac).toBe(10);setAutomationEnabled(restored,true);expect(evaluate(restored).ac).toBe(17);expect(restored.runtime.resources.spent.current).toBe(0);
  const rule=evaluateFeatureArmor(restored.selections).rules[0];expect(rule).toMatchObject({selectionId:selected.id,entryId:selected.entry.id,source:'XPHB',edition:'2024',revision:'authored-fixture',path:'entries:0',bonus:1});
 });
 it('keeps feat opt-outs and source editions separate without merging display names',()=>{
  const {c,entries,choice}=armorFeatureFixture();select(c,entries,choice.id);c.profile.optional.feats=false;expect(evaluate(c).ac).toBe(16);c.profile.optional.feats=true;expect(evaluate(c).ac).toBe(17);
  const old=armorFeatureFixture('2014');expect(old.entries.find(e=>e.name==='测试护甲加值')!.id).not.toBe(entries.find(e=>e.name==='测试护甲加值')!.id);
  const content=sheetChoices(c,[...entries,...old.entries]).find(r=>r.id===choice.id)!;expect(content.options.every(o=>o.entry.edition==='2024')).toBe(true);
 });
 it.each([
  '着装护甲时，你的AC获得 +1加值。',
  '着装轻甲、中甲或重甲期间，你的{@variantrule 护甲等级|XPHB}获得 +1 加值。',
  'While you are wearing armor, you gain a +1 bonus to AC.',
  'While wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.',
 ])('recognizes constrained Chinese/English mechanics without names: %s',text=>{
  const {c,entries,choice}=armorFeatureFixture();select(c,entries,choice.id);const selected=c.selections.find(s=>s.grantKey?.startsWith('choice:'))!;selected.entry.entries=[text];selected.entry.name='Completely renamed';selected.entry.english='No lookup name';expect(evaluate(c).ac).toBe(17);
 });
 it.each([
  '着装护甲时，若你未持盾，你的AC获得 +1 加值。',
  '你的AC获得 +2 加值，持续一分钟。',
  'While wearing armor, you gain a +1 bonus to AC if you are not wielding a shield.',
  'While wearing armor, you gain a +1 bonus to AC. Your speed is reduced to 0.',
 ])('does not guess unsupported extra conditions and keeps a warning: %s',text=>{
  const {c,entries,choice}=armorFeatureFixture();select(c,entries,choice.id);c.selections.find(s=>s.grantKey?.startsWith('choice:'))!.entry.entries=[text];expect(evaluate(c).ac).toBe(16);expect(evaluate(c).issues.some(i=>i.id.startsWith('feature-ac-rule:'))).toBe(true);
 });
 it('does not count choices before selection, duplicate saved sources, duplicate prose, or explicit AC effects twice',()=>{
  const {c,entries,choice}=armorFeatureFixture('2014');const owner=c.selections.find(s=>s.entry.name==='测试风格')!;owner.entry.entries.push({type:'options',entries:[{type:'entries',name:'未选',entries:[sentence]}]});expect(evaluate(c).ac).toBe(16);select(c,entries,choice.id);
  const selected=c.selections.find(s=>s.grantKey?.startsWith('choice:'))!;c.selections.push({...structuredClone(selected),id:'duplicate'});selected.entry.entries.push(sentence);expect(evaluate(c).ac).toBe(17);c.selections.pop();selected.entry.effects=[{op:'add',target:'ac',value:2}];expect(evaluate(c).ac).toBe(18);
 });
 it('does not double a named source subfeature or count zero quantity/conflicting body armor',()=>{
  const {c,entries}=armorFeatureFixture();const [race]=normalizeData({race:[{name:'原创种族',source:'XPHB',startingEquipment:[{_:[{special:'原创旅行袋'}]}],entries:[{type:'entries',name:'原创护甲特征',entries:[sentence]}]}]},'authored');c.selections.push({id:'race',entry:race,level:1,quantity:1,equipped:false});syncFeatures(c,[...entries,race]);expect(evaluate(c).ac).toBe(17);
  const armor=c.selections.find(s=>s.id==='armor')!;armor.quantity=0;expect(evaluate(c).ac).toBe(10);armor.quantity=1;c.selections.push({...structuredClone(armor),id:'second-armor'});expect(evaluate(c).ac).toBe(10);expect(evaluate(c).issues.some(i=>i.id==='equipment-conflict:armor')).toBe(true);
 });
});

const realFeats=process.env.DND_ARMOR_FEATS,realOptional=process.env.DND_ARMOR_OPTIONALFEATURES,realFighter=process.env.DND_ARMOR_FIGHTER;
it.skipIf(!realFeats||!realOptional||!realFighter)('current external 2014/2024 Fighter sources grant Defense through their actual declared choices',()=>{
 const load=(path:string)=>normalizeData(JSON.parse(readFileSync(path,'utf8')),'external-corpus');const entries=[...load(realFeats!),...load(realOptional!),...load(realFighter!)];
 for(const edition of ['2014','2024'] as const){const source=edition==='2024'?'XPHB':'PHB',{c}=armorFeatureFixture(edition);c.selections=c.selections.filter(s=>s.entry.kind==='item');const cls=entries.find(e=>e.kind==='class'&&e.english==='Fighter'&&e.source===source)!;expect(cls).toBeDefined();c.selections.push({id:'class',entry:cls,quantity:1,level:1,equipped:false});syncFeatures(c,entries);
  const choice=sheetChoices(c,entries).find(r=>r.options.some(o=>o.entry.english==='Defense'))!;expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,choice.options.find(o=>o.entry.english==='Defense')!.value,entries);syncFeatures(c,entries);expect(evaluate(c).ac).toBe(17);equipSelection(c,'armor',false);expect(evaluate(c).ac).toBe(10);
 }
});
