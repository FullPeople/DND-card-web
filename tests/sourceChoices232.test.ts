import {planFeatureResources} from '../src/core/automation/featureResources';
import {describe,expect,it} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {newAutomationState} from '../src/core/automation/state';
import {backgroundAbilityOptions} from '../src/core/automation/backgroundAbilities';
import {sourceEquipmentKey,sourceEquipmentReceipt} from '../src/core/automation/sourceEquipment';
import {sheetChoices,chooseSheetOption,claimStartingEquipment,builtinChoices,builtinOptionsVisible} from '../src/core/automation/choices';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';

const catalog=normalizeData({background:[{name:'来源选择验收背景',source:'XPHB',ability:[{choose:{weighted:{from:['int','wis','cha'],weights:[2,1]}}}],startingEquipment:[{_:[{item:'固定用品|XPHB'},{value:500}],A:[{item:'选装用品|XPHB'},{value:300}],B:[{value:1200}]}]}],item:[{name:'固定用品',source:'XPHB',weight:1},{name:'选装用品',source:'XPHB',weight:2}]},'fixture');
function card(entry=catalog.find(e=>e.kind==='background')!):Character{const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'background-owner',entry:structuredClone(entry),quantity:1,level:1,equipped:false}];return c;}
const equipment=(c:Character)=>sheetChoices(c,catalog).find(choice=>choice.channel==='equipment')!;

describe('source choice bubbles and saved background allocations',()=>{
 it('offers declared background allocations and equipment before a class is selected',()=>{
  const c=card(),choices=sheetChoices(c,catalog),abilities=choices.find(choice=>choice.channel==='abilities')!;
  expect(abilities.options).toHaveLength(6);expect(abilities.complete).toBe(false);
  expect(builtinChoices(c,'background-owner',choices).map(choice=>choice.channel)).toEqual(['abilities','equipment']);expect(builtinOptionsVisible(c,'background-owner',choices)).toBe(true);
  const before=structuredClone(c),option=abilities.options.find(option=>option.abilities?.int===2&&option.abilities?.wis===1)!;
  chooseSheetOption(c,abilities.id,option.value,catalog);expect(c.backgroundChoices?.['background-owner'].abilities).toEqual({int:2,wis:1});
  expect(c.abilities).toEqual(before.abilities);expect(evaluate(c).abilities).toEqual(evaluate(before).abilities);expect(c.selections).toEqual(before.selections);
  const restored=validateCharacter(exportCharacter(c));expect(sheetChoices(restored,catalog).find(choice=>choice.channel==='abilities')?.selected).toEqual([option.value]);
 });
 it('preserves older allocation records, including unmatched manual values, until an explicit choice',()=>{
  const c=card();c.backgroundChoices={'background-owner':{abilities:{int:2,cha:1},equipment:{'0':'B'}}};
  const before=structuredClone(c);expect(sheetChoices(c,catalog).find(choice=>choice.channel==='abilities')?.complete).toBe(true);expect(c).toEqual(before);
  c.backgroundChoices['background-owner'].abilities={int:5};const manual=structuredClone(c);expect(sheetChoices(c,catalog).find(choice=>choice.channel==='abilities')?.complete).toBe(false);expect(c).toEqual(manual);
  c.selections[0].entry.raw.ability=[{unsupported:true}];const unknown=sheetChoices(c,catalog).find(choice=>choice.channel==='abilities')!;expect(unknown.options).toEqual([]);expect(unknown.hint).toContain('尚未支持');expect(c.backgroundChoices['background-owner'].abilities).toEqual({int:5});
 });
 it('enumerates equal-weight allocations once and rejects unsupported or invalid declarations',()=>{
  const entry=structuredClone(catalog[0]);entry.raw.ability=[{choose:{from:['str','dex','con'],count:2,amount:1}}];expect(backgroundAbilityOptions(entry)).toHaveLength(3);
  for(const ability of [[{choose:{from:['str'],count:2}}],[{choose:{weighted:{from:['str','dex'],weights:[-1,2]}}}],[{unknown:2}]]){entry.raw.ability=ability;expect(backgroundAbilityOptions(entry)).toEqual([]);}
 });
});

describe('background equipment receipts and explicit claims',()=>{
 it('delivers fixed goods once, then confirms only the chosen remainder; explicit reclaims still append',()=>{
  const c=card();syncFeatures(c,catalog);expect(c.inventory?.coins.gp).toBe(5);expect(c.selections.filter(row=>row.entry.kind==='item')).toHaveLength(1);expect(equipment(c).complete).toBe(false);
  for(let n=0;n<8;n++)syncFeatures(c,catalog);expect(c.inventory?.coins.gp).toBe(5);
  const choice=equipment(c);claimStartingEquipment(c,choice.id,'A',catalog);syncFeatures(c,catalog);expect(c.inventory?.coins.gp).toBe(8);expect(c.selections.filter(row=>row.entry.kind==='item')).toHaveLength(2);expect(equipment(c).complete).toBe(true);
  claimStartingEquipment(c,choice.id,'A',catalog);expect(c.inventory?.coins.gp).toBe(16);expect(c.selections.filter(row=>row.entry.kind==='item')).toHaveLength(4);
  const restored=validateCharacter(exportCharacter(c));for(let n=0;n<8;n++)syncFeatures(restored,catalog);expect(restored.inventory?.coins.gp).toBe(16);expect(restored.selections.filter(row=>row.entry.kind==='item')).toHaveLength(4);
 });
 it('source toggles, removal, replacement and readding the same identity never replenish spent possessions',()=>{
  const c=card(),entry=structuredClone(c.selections[0].entry);syncFeatures(c,catalog);claimStartingEquipment(c,equipment(c).id,'A',catalog);
  c.inventory!.coins.gp=1;const consumed=c.selections.find(row=>row.entry.name==='固定用品')!;removeSelection(c,consumed.id);const kept=c.selections.find(row=>row.entry.kind==='item')!;kept.quantity=3;
  c.profile.enabledSources=[];syncFeatures(c,catalog);c.profile.enabledSources=['XPHB'];syncFeatures(c,catalog);expect(c.inventory!.coins.gp).toBe(1);expect(c.selections.filter(row=>row.entry.kind==='item')).toEqual([kept]);
  removeSelection(c,'background-owner');c.selections.push({id:'background-returned',entry,quantity:1,level:1,equipped:false});syncFeatures(c,catalog);expect(c.inventory!.coins.gp).toBe(1);expect(c.selections.filter(row=>row.entry.kind==='item')).toEqual([kept]);expect(equipment(c).complete).toBe(true);
  const other={...structuredClone(entry),id:entry.id+':different',name:'其他背景'};removeSelection(c,'background-returned');c.selections.push({id:'other-background',entry:other,quantity:1,level:1,equipped:false});syncFeatures(c,catalog);expect(c.inventory!.coins.gp).toBe(6);expect(c.inventory!.sourceEquipment?.[sourceEquipmentKey(entry)]).toBeDefined();expect(c.inventory!.sourceEquipment?.[sourceEquipmentKey(other)]).toBeDefined();
 });
 it('migrates already claimed legacy goods and coin ledgers without altering IDs, quantities or balances',()=>{
  const c=card(),item=catalog.find(e=>e.name==='选装用品')!;c.backgroundChoices={'background-owner':{equipment:{'0':'A'}}};c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:1,pp:0},grantedCoins:{'background-owner|equipment:0':8}};
  c.selections.push({id:'legacy-possession',entry:structuredClone(item),parentId:'background-owner',grantKey:'equipment:0:A:0',quantity:4,level:1,equipped:true,attuned:true});const before=structuredClone(c.selections[1]);
  syncFeatures(c,catalog);expect(c.selections[1]).toEqual(before);expect(c.inventory.coins.gp).toBe(1);expect(sourceEquipmentReceipt(c,c.selections[0])?.completed).toBe(true);
  removeSelection(c,'background-owner');const saved=c.selections.find(row=>row.id==='legacy-possession')!;expect(saved).toMatchObject({id:before.id,entry:before.entry,quantity:4,equipped:true,attuned:true,grantKey:before.grantKey});expect(saved.parentId).toBeUndefined();expect(c.inventory.coins.gp).toBe(1);
 });
 it('keeps partially claimed legacy fixed items without duplicating them at first choice confirmation',()=>{
  const c=card(),fixed=catalog.find(e=>e.name==='固定用品')!;c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:2,pp:0},grantedCoins:{'background-owner|equipment:0':5}};c.selections.push({id:'old-fixed',entry:fixed,parentId:'background-owner',grantKey:'equipment:0:_:0',quantity:2,level:1,equipped:false});
  syncFeatures(c,catalog);expect(equipment(c).complete).toBe(false);claimStartingEquipment(c,equipment(c).id,'A',catalog);expect(c.inventory.coins.gp).toBe(5);expect(c.selections.filter(row=>row.entry.name==='固定用品')).toHaveLength(1);expect(c.selections.find(row=>row.id==='old-fixed')?.quantity).toBe(2);
 });
 it('late catalog hydration fills fixed and chosen placeholders without changing quantities or regranting coins',()=>{
  const c=card();syncFeatures(c,[]);claimStartingEquipment(c,equipment(c).id,'A',[]);const goods=c.selections.filter(row=>row.entry.kind==='item');expect(goods.every(row=>row.entry.raw._equipmentRef)).toBe(true);goods[0].quantity=4;goods[0].equipped=true;const retained=goods[0].id,removed=goods[1].id;removeSelection(c,removed);c.inventory!.coins.gp=2;
  for(let n=0;n<4;n++)syncFeatures(c,catalog);expect(c.selections.filter(row=>row.entry.kind==='item')).toHaveLength(1);expect(c.selections.find(row=>row.id===retained)).toMatchObject({quantity:4,equipped:true});expect(c.selections.find(row=>row.id===retained)?.entry.raw._equipmentRef).toBeUndefined();expect(c.inventory!.coins.gp).toBe(2);
 });
 it('fixed-only sources auto-grant once and invalid shapes remain pending without partial inventory writes',()=>{
  const entry=structuredClone(catalog[0]);entry.raw.startingEquipment=[{_:[{special:'固定纪念品'},{value:200}]}];const c=card(entry);syncFeatures(c,[]);expect(equipment(c).complete).toBe(true);expect(c.inventory?.coins.gp).toBe(2);removeSelection(c,c.selections.find(row=>row.entry.kind==='item')!.id);syncFeatures(c,[]);expect(c.selections.filter(row=>row.entry.kind==='item')).toHaveLength(0);
  const invalid=card();invalid.selections[0].entry.raw.startingEquipment=[{A:{unknown:true}}];const before=structuredClone(invalid);syncFeatures(invalid,[]);expect(invalid).toEqual(before);expect(()=>claimStartingEquipment(invalid,equipment(invalid).id,'A',[])).toThrow(/尚未支持/);expect(invalid).toEqual(before);
  invalid.selections[0].entry.raw.startingEquipment=[{A:[{unknown:true}]}];const unknown=structuredClone(invalid);syncFeatures(invalid,[]);expect(invalid).toEqual(unknown);expect(()=>claimStartingEquipment(invalid,equipment(invalid).id,'A',[])).toThrow(/尚未支持/);expect(invalid).toEqual(unknown);
 });
 it('rejects malformed packages and excessive balances atomically, keeping unsupported choices pending',()=>{
  for(const packageItems of [[{unknown:true}],[null],[{item:'选装用品|XPHB',quantity:0}],[{item:'选装用品|XPHB'},{value:-100}]]){
   const c=card();c.selections[0].entry.raw.startingEquipment=[{A:packageItems,B:[{value:100}]}];
   const before=structuredClone(c);const choice=equipment(c);expect(choice.complete).toBe(false);expect(()=>claimStartingEquipment(c,choice.id,'A',catalog)).toThrow();expect(c).toEqual(before);
  }
  const c=card();syncFeatures(c,catalog);c.inventory!.coins.gp=999999;const before=structuredClone(c);expect(()=>claimStartingEquipment(c,equipment(c).id,'A',catalog)).toThrow(/上限/);expect(c).toEqual(before);
 });
 it('shows malformed source equipment as pending instead of throwing while reading the card',()=>{
  for(const declaration of [[null],[{A:null}]]){
   const c=card();c.selections[0].entry.raw.startingEquipment=declaration;c.backgroundChoices={'background-owner':{equipment:{'0':'A'}}};const before=structuredClone(c);
   expect(()=>sheetChoices(c,catalog)).not.toThrow();expect(equipment(c).complete).toBe(false);expect(equipment(c).hint).toContain('尚未支持');expect(()=>syncFeatures(c,catalog)).not.toThrow();expect(c).toEqual(before);
  }
 });
 it('rejects malformed imported scalar names and money before any inventory writes',()=>{
  for(const invalid of [{special:{oops:true}},{special:42},{item:{ref:'rope|XPHB'}},{item:42},{value:true},{containsValue:'100'},{quantity:'2',special:'token'},{special:'x'.repeat(301)},{item:'x'.repeat(301)+'|XPHB'},'x'.repeat(301)+'|XPHB']){
   const c=card();c.selections[0].entry.raw.startingEquipment=[{A:[{item:'固定用品|XPHB'},invalid]}];const before=structuredClone(c);expect(()=>syncFeatures(c,catalog)).not.toThrow();expect(c).toEqual(before);expect(()=>claimStartingEquipment(c,equipment(c).id,'A',catalog)).toThrow();expect(c).toEqual(before);
  }
 });
 it('validates receipt input on import rather than accepting malformed persistent grant history',()=>{
  const c=card();syncFeatures(c,catalog);const restored=validateCharacter(exportCharacter(c));expect(restored.inventory?.sourceEquipment).toEqual(c.inventory?.sourceEquipment);
  const key=sourceEquipmentKey(c.selections[0].entry);c.inventory!.sourceEquipment![key].received=42 as any;expect(()=>validateCharacter(c)).toThrow(/领取记录/);
 });
});

describe('2014 source-owned racial ability scores',()=>{
 const races=normalizeData({race:[{name:'验收矮人',source:'PHB',ability:[{con:2}],speed:25},{name:'验收精灵',source:'PHB',ability:[{dex:2}],speed:30}]},'fixture');
 const dwarf=()=>{const c=newCharacter('2014');c.abilities.con=14;c.selections=[{id:'race-owner',entry:structuredClone(races[0]),quantity:1,level:1,equipped:false}];return c;};
 it('adds CON +2 to base 14 exactly once with a visible source trace and persistence',()=>{
  const c=dwarf();for(let i=0;i<8;i++){syncFeatures(c,races);const d=evaluate(c);expect(d.abilities.con).toBe(16);expect(d.modifiers.con).toBe(3);expect(d.trace.con).toEqual(['基础 14','种族：验收矮人 · PHB +2']);}expect(c.abilities.con).toBe(14);
  const restored=validateCharacter(exportCharacter(c));expect(restored.racialAbilityMode).toBe('separate-v1');expect(evaluate(restored).abilities.con).toBe(16);
 });
 it('removes the old increase when changing or disabling race and ignores legacy increases in 2024',()=>{
  const c=dwarf();c.selections[0].entry=structuredClone(races[1]);expect(evaluate(c).abilities.con).toBe(14);expect(evaluate(c).abilities.dex).toBe(12);
  c.profile.enabledSources=[];expect(evaluate(c).abilities.dex).toBe(10);c.profile.enabledSources=['PHB'];expect(evaluate(c).abilities.dex).toBe(12);
  c.edition='2024';c.profile.optional.legacy=true;expect(evaluate(c).abilities.dex).toBe(10);expect(evaluate(c).trace.dex).toEqual(['基础 10']);
  removeSelection(c,'race-owner');expect(evaluate(c).abilities.con).toBe(14);
 });
 it('preserves old manually adjusted cards and warns instead of silently converting their base scores',()=>{
  const c=dwarf();delete c.racialAbilityMode;c.abilities.con=16;const before=structuredClone(c);const restored=validateCharacter(exportCharacter(c));syncFeatures(restored,races);
  const d=evaluate(restored);expect(restored.abilities.con).toBe(16);expect(d.abilities.con).toBe(16);expect(d.trace.con.join(' ')).toContain('尚未确认');expect(d.issues.some(issue=>issue.id==='racial-ability:legacy:race-owner')).toBe(true);expect(restored.racialAbilityMode).toBeUndefined();expect(c).toEqual(before);
 });
 it('uses the same racial total in ability-linked resource formulas',()=>{
  const c=dwarf();c.automation=newAutomationState();c.selections[0].entry.raw.resources=[{name:'体质次数',max:'@abilities.con.mod',recovery:'long'}];expect(planFeatureResources(c).grants[0].max).toBe(evaluate(c).modifiers.con);expect(planFeatureResources(c).grants[0].max).toBe(3);
  c.selections[0].entry.effects=[{op:'add',target:'con',value:2}];expect(planFeatureResources(c).grants[0].max).toBe(3);delete c.selections[0].entry.effects;
  delete c.racialAbilityMode;expect(planFeatureResources(c).grants[0].max).toBe(2);c.racialAbilityMode='separate-v1';c.edition='2024';c.profile.optional.legacy=true;expect(planFeatureResources(c).grants[0].max).toBe(2);
 });
 it('does not duplicate existing explicit rule effects or silently resolve optional racial allocations',()=>{
  const c=dwarf();c.selections[0].entry.effects=[{op:'add',target:'con',value:2}];expect(evaluate(c).abilities.con).toBe(16);
  delete c.selections[0].entry.effects;c.selections[0].entry.raw.ability=[{choose:{from:['con','str'],count:1,amount:2}}];expect(evaluate(c).abilities.con).toBe(14);expect(evaluate(c).issues.some(issue=>issue.id==='racial-ability:unsupported:race-owner')).toBe(true);
  c.racialAbilityMode='unknown' as any;expect(()=>validateCharacter(c)).toThrow(/种族属性计算版本/);
 });
});
