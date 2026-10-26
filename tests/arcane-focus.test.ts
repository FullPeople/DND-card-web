import {it,expect} from 'vitest';
import {evaluate} from '../src/core/engine';
import {spellValues} from '../src/core/characterDetails';
import {arcaneFocusFixture} from './e2e/arcaneFocusFixture';

it('applies an explicitly held attuned enhanced focus to spell attack only',()=>{
 const {c,entry,choiceId}=arcaneFocusFixture();c.infusions={version:1,bindings:[{choiceId,entryId:entry.id,targetId:'focus-0',...{held:true}}]};
 const before=JSON.stringify(c);expect(spellValues(c,evaluate(c))).toEqual({attack:8,dc:16});expect(JSON.stringify(c)).toBe(before);
});

import {infusionTargets,infusionRule,setInfusionTarget,setInfusionHeld,reconcileInfusionHolding,validateInfusions} from '../src/core/automation/infusions';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {readCharacter,validateCharacter,importOwlbear} from '../src/core/validation';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {enhancedWeaponFixture} from './e2e/enhancedWeaponFixture';
import {normalizeData} from '../src/data/catalog';
import type {Character,Selection} from '../src/core/model';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const values=(c:Character)=>spellValues(c,evaluate(c));
const focus=(c:Character,id='focus-0')=>c.selections.find(row=>row.id===id)!;
function activate(){const state=arcaneFocusFixture();setInfusionTarget(state.c,state.choiceId,state.entry.id,'focus-0');setInfusionHeld(state.c,state.choiceId,state.entry.id,true);return state;}

it('learning, targeting, equipping and attuning never imply held confirmation, including old saves',()=>{
 const {c,entry,choiceId}=arcaneFocusFixture();expect(values(c)).toEqual({attack:7,dc:16});expect(infusionTargets(c,entry).map(row=>row.id)).toEqual(['focus-0','focus-1','focus-2']);
 setInfusionTarget(c,choiceId,entry.id,'focus-0');expect(values(c)).toEqual({attack:7,dc:16});expect(c.infusions!.bindings[0].held).toBeUndefined();
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(values(restored).attack).toBe(7);setInfusionHeld(restored,choiceId,entry.id,true);expect(values(restored).attack).toBe(8);
});
it.each([2,9,10,20])('scales spell attack only from artificer level %i',level=>{
 const {c}=activate();focus(c,'infusion-owner').level=level;const d=evaluate(c);expect(values(c)).toEqual({attack:3+d.proficiency+2+(level>=10?2:1),dc:8+3+d.proficiency+3});
});
it('does not upgrade with total multiclass level and applies the same bonus across casting abilities',()=>{
 const {c}=activate();const other=structuredClone(focus(c,'infusion-owner'));other.id='other-class';other.level=8;other.entry={...other.entry,id:'other-class-entry',name:'原创施法者',english:'Authored Caster',source:'PHB',raw:{spellcastingAbility:'wis',casterProgression:'full'}};c.selections.push(other);
 const d=evaluate(c);expect(d.proficiency).toBe(4);expect(values(c)).toEqual({attack:10,dc:18});expect(spellValues(c,d,'wis')).toEqual({attack:9,dc:17});
});
it.each(['equipped','attuned','held'] as const)('requires %s independently and never mutates during evaluation',condition=>{
 const {c,entry,choiceId}=arcaneFocusFixture();setInfusionTarget(c,choiceId,entry.id,'focus-0');
 if(condition==='held')c.infusions!.bindings[0].held=false;else focus(c)[condition]=false;
 const before=JSON.stringify(c);expect(values(c).attack).toBe(7);expect(JSON.stringify(c)).toBe(before);
 if(condition!=='held'){expect(()=>setInfusionHeld(c,choiceId,entry.id,true)).toThrow(/装备及同调/);expect(JSON.stringify(c)).toBe(before);}
});
it.each(['equipped','attuned','removed'] as const)('explicit %s edits clear stale holding and do not rewrite manual fields',condition=>{
 const {c,choiceId,entry}=activate(),prior=structuredClone(c),manual=JSON.stringify(c.spellSettings),target=focus(c);
 if(condition==='removed')c.selections=c.selections.filter(row=>row.id!==target.id);else target[condition]=false;
 expect(values(c).attack).toBe(7);reconcileInfusionHolding(prior,c);expect(c.infusions!.bindings[0].held).toBeUndefined();
 if(condition==='removed')c.selections.push(target);else target[condition]=true;
 expect(values(c).attack).toBe(7);setInfusionHeld(c,choiceId,entry.id,true);expect(values(c).attack).toBe(8);expect(JSON.stringify(c.spellSettings)).toBe(manual);
});
it('replacing the target resets holding without automatically equipping or attuning the new instance',()=>{
 const {c,entry,choiceId}=activate();c.selections.push({...structuredClone(focus(c)),id:'focus-copy'});expect(values(c).attack).toBe(8);
 setInfusionTarget(c,choiceId,entry.id,'focus-copy');expect(c.infusions!.bindings[0].held).toBeUndefined();expect(values(c).attack).toBe(7);setInfusionHeld(c,choiceId,entry.id,true);expect(values(c).attack).toBe(8);
 setInfusionTarget(c,choiceId,entry.id,'focus-1');expect(focus(c,'focus-1')).toMatchObject({equipped:false,attuned:false});expect(c.infusions!.bindings[0].held).toBeUndefined();expect(values(c).attack).toBe(7);
});
it.each([
 ['other focus',(row:Selection):void=>{row.entry.english='Crystal';row.entry.raw.ENG_name='Crystal';row.entry.raw.name='Crystal';}],
 ['wrong source',(row:Selection):void=>{row.entry.source='XPHB';}],
 ['wrong focus type',(row:Selection):void=>{row.entry.raw.scfType='druid';}],
 ['wrong item type',(row:Selection):void=>{row.entry.raw.type='M';}],
 ['stacked copies',(row:Selection):void=>{row.quantity=2;}],
 ['magic item',(row:Selection):void=>{row.entry.raw.rarity='uncommon';}],
 ['manual magic bonus',(row:Selection):void=>{row.entry.raw.bonusSpellAttack=3;}],
 ['preexisting attunement requirement',(row:Selection):void=>{row.entry.raw.reqAttune=true;}],
] as const)('rejects %s rather than recognizing a translated name',(_label,change)=>{
 const {c,entry,choiceId}=arcaneFocusFixture();change(focus(c));const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,entry.id,'focus-0')).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('uses source identities independently of display labels for both rule and focus',()=>{
 const {c,entry,choiceId}=arcaneFocusFixture();entry.name='玩家自定义注法标题';focus(c).entry.name='玩家自定义物品标题';setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);expect(values(c).attack).toBe(8);
 entry.source='ERLW';expect(infusionRule(entry)).toBeUndefined();expect(values(c).attack).toBe(7);
});
it('suspends both conflicting source-qualified copies with different IDs instead of stacking them',()=>{
 const {c,entry,choiceId}=activate(),copy=structuredClone(entry);copy.id+=':duplicate';c.classChoiceSnapshots![copy.id]=copy;c.answers[choiceId].push(copy.id);const second=focus(c,'focus-1');second.equipped=true;second.attuned=true;
 const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,copy.id,second.id)).toThrow(/同一注法/);expect(JSON.stringify(c)).toBe(before);
 c.infusions!.bindings.push({choiceId,entryId:copy.id,targetId:second.id,held:true});expect(values(c).attack).toBe(7);
});
it('preserves native and linked holding state but withdrawal removes only the generated bonus',()=>{
 const {c,choiceId,entry}=activate();c.runtime.resources.test={max:4,current:1};const manual=JSON.stringify(c.spellSettings),items=JSON.stringify(c.selections),runtime=JSON.stringify(c.runtime);
 for(const output of [exportCharacter(c),exportLinkedOwlbear(c,evaluate(c))]){
  const restored='character' in output?readCharacter(output).character:importOwlbear(output);expect(restored.infusions!.bindings[0].held).toBe(true);expect(values(restored)).toEqual({attack:8,dc:16});
  setInfusionTarget(restored,choiceId,entry.id,null);expect(values(restored)).toEqual({attack:7,dc:16});expect(JSON.stringify(restored.spellSettings)).toBe(manual);expect(JSON.stringify(restored.selections)).toBe(items);expect(JSON.stringify(restored.runtime)).toBe(runtime);
 }
});
it('plain legacy export keeps its baked total without inventing a live infusion on import',()=>{
 const {c}=activate(),output=exportOwlbear(c,evaluate(c));expect(output.spellcasting).toMatchObject({attack_bonus:8,save_dc:16});const restored=importOwlbear(output);expect(restored.infusions).toBeUndefined();expect(values(restored)).toEqual({attack:8,dc:16});
});
it.each(['source','option','feature','owner','target','automation'] as const)('suspends %s without deleting binding or held intent',mode=>{
 const {c,entry}=activate(),before=JSON.stringify(c.infusions);if(mode==='source')c.profile.enabledSources=['PHB'];else if(mode==='automation')c.automation!.enabled=false;else c.profile.disabledEntries=[mode==='option'?entry.id:focus(c,mode==='feature'?'infusion-feature':mode==='owner'?'infusion-owner':'focus-0').entry.id];
 expect(evaluate(c).trace.spellAttack.some(line=>line.includes('注法 +'))).toBe(false);expect(JSON.stringify(c.infusions)).toBe(before);c.profile.enabledSources=['PHB','TCE'];c.profile.disabledEntries=[];c.automation!.enabled=true;expect(values(c).attack).toBe(8);
});
it('allows clearing holding or withdrawing while sources are disabled but rejects a new held confirmation',()=>{
 const {c,entry,choiceId}=activate();c.profile.enabledSources=['PHB'];setInfusionHeld(c,choiceId,entry.id,false);expect(c.infusions!.bindings[0].held).toBeUndefined();const before=JSON.stringify(c);expect(()=>setInfusionHeld(c,choiceId,entry.id,true)).toThrow();expect(JSON.stringify(c)).toBe(before);setInfusionTarget(c,choiceId,entry.id,null);expect(c.infusions!.bindings).toEqual([]);
});
it('forgets through the choice transaction and never revives holding on relearning',()=>{
 const {c,entry,choiceId,entries}=activate();setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);expect(values(c).attack).toBe(7);setSheetChoiceSlot(c,choiceId,0,entry.id,entries);expect(values(c).attack).toBe(7);
});
it('keeps weapon attack, damage, AC, manual spell settings and snapshots unchanged',()=>{
 const {c,entry,choiceId}=arcaneFocusFixture(),weapons=enhancedWeaponFixture();c.selections.push(...weapons.c.selections.filter(row=>row.id.startsWith('weapon-')));const before={attacks:automaticWeaponAttacks(c,evaluate(c)).attacks,ac:evaluate(c).ac,settings:JSON.stringify(c.spellSettings),snapshots:JSON.stringify(c.classChoiceSnapshots)};
 setInfusionTarget(c,choiceId,entry.id,'focus-0');setInfusionHeld(c,choiceId,entry.id,true);expect(values(c)).toEqual({attack:8,dc:16});expect(automaticWeaponAttacks(c,evaluate(c)).attacks).toEqual(before.attacks);expect(evaluate(c).ac).toBe(before.ac);expect(JSON.stringify(c.spellSettings)).toBe(before.settings);expect(JSON.stringify(c.classChoiceSnapshots)).toBe(before.snapshots);
});
it('validates held metadata strictly and preserves unknown future versions without activating them',()=>{
 const {c}=activate();for(const held of ['yes',1,null,{}])expect(()=>validateInfusions({version:1,bindings:[{...c.infusions!.bindings[0],held}]})).toThrow();expect(()=>validateInfusions({version:1,bindings:[{...c.infusions!.bindings[0],held:false}]})).not.toThrow();
 (c.infusions as any).version=2;const before=JSON.stringify(c.infusions);expect(values(c).attack).toBe(7);expect(()=>setInfusionHeld(c,'x','y',true)).toThrow();reconcileInfusionHolding(c,c);expect(JSON.stringify(c.infusions)).toBe(before);
});
it('reports half-cover as a manual boundary in evaluation traces and linked exports',()=>{
 const {c}=activate(),before=JSON.stringify(c),d=evaluate(c);expect(d.trace.spellAttack.join(' ')).toContain('注法 +1');expect(d.trace.spellAttack.join(' ')).toContain('半身掩护仍需手动');expect(d.issues.some(issue=>issue.message.includes('不增加法术 DC 或伤害'))).toBe(true);expect(exportLinkedOwlbear(c,d).export_warnings.join(' ')).toContain('半身掩护仍需手动');expect(JSON.stringify(c)).toBe(before);
});

const sourceDir=process.env.INFUSION_SOURCE_DIR,frozenDir=process.env.INFUSION_FROZEN_DIR;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
it.skipIf(!sourceDir)('replays the exact frozen focus source through real learning, holding, level ten, reopen and withdrawal',()=>{
 const optional=JSON.parse(readFileSync(`${sourceDir}/optionalfeatures-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),classes=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8'));
 expect(hash(optional)).toBe('031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844');expect(hash(classes)).toBe('c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7');expect(hash(optional.optionalfeature.find((row:any)=>row.ENG_name==='Enhanced Arcane Focus'&&row.source==='TCE'))).toBe('74a9b4756537cb2a3dc3eddd2da7311fcee4a0703e7550dde24d3705c4df851d');
 const entries=normalizeData({...classes,...optional},'frozen-arcane-focus'),entry=entries.find(row=>row.source==='TCE'&&row.english==='Enhanced Arcane Focus')!,{c}=arcaneFocusFixture();focus(c,'infusion-owner').entry=entries.find(row=>row.kind==='class'&&row.source==='TCE'&&row.english==='Artificer')!;focus(c,'infusion-feature').entry=entries.find(row=>row.raw._category==='classFeature'&&row.source==='TCE'&&row.english==='Infuse Item')!;c.answers={};c.classChoiceSnapshots={};
 const choice=sheetChoices(c,entries).find(row=>row.ownerId==='infusion-owner'&&row.options.some(option=>option.entry.id===entry.id))!;expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,entry.id,entries);expect(values(c).attack).toBe(7);setInfusionTarget(c,choice.id,entry.id,'focus-0');expect(values(c).attack).toBe(7);setInfusionHeld(c,choice.id,entry.id,true);expect(values(c).attack).toBe(8);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));focus(restored,'infusion-owner').level=10;expect(values(restored)).toEqual({attack:11,dc:18});setInfusionTarget(restored,choice.id,entry.id,null);expect(values(restored)).toEqual({attack:9,dc:18});
});
it.skipIf(!frozenDir)('checks the three reviewed PHB target identities against all actual SCF base items',()=>{
 const index=JSON.parse(readFileSync(`${frozenDir}/index.json`,'utf8')),input=index.rows.find((row:any)=>row.url==='https://5e.kiwee.top/data/items-base.json'),data=JSON.parse(readFileSync(`${frozenDir}/${input.path}`,'utf8'));expect(hash(data)).toBe('8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff');
 const {c,entry,choiceId}=arcaneFocusFixture();c.selections=c.selections.filter(row=>row.entry.kind!=='item');const items=normalizeData(data,'frozen-focus-items').filter(row=>row.kind==='item'&&String(row.raw.type).split('|')[0]==='SCF');expect(items.length).toBeGreaterThan(3);c.selections.push(...items.map((entry,index)=>({id:`real-focus-${index}`,entry,level:1,quantity:1,equipped:true,attuned:true})));
 const targets=infusionTargets(c,entry);expect(targets.map(row=>`${row.entry.english}|${row.entry.source}`).sort()).toEqual(['Rod|PHB','Staff|PHB','Wand|PHB']);
 for(const target of targets){setInfusionTarget(c,choiceId,entry.id,target.id);expect(values(c).attack).toBe(7);setInfusionHeld(c,choiceId,entry.id,true);expect(values(c)).toEqual({attack:8,dc:16});}
});

it('shares target reservations and the existing active-infusion capacity without displacing earlier bindings',()=>{
 const {c,entry,choiceId,defense}=activate(),weapons=enhancedWeaponFixture();c.selections.push(...weapons.c.selections.filter(row=>row.id.startsWith('weapon-')));c.classChoiceSnapshots![defense.id]=defense;c.classChoiceSnapshots![weapons.entry.id]=weapons.entry;c.answers[choiceId].push(defense.id,weapons.entry.id);
 setInfusionTarget(c,choiceId,defense.id,'infusion-item-0');const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,weapons.entry.id,'weapon-0')).toThrow(/上限/);expect(JSON.stringify(c)).toBe(before);expect(values(c).attack).toBe(8);setInfusionTarget(c,choiceId,entry.id,null);setInfusionTarget(c,choiceId,weapons.entry.id,'weapon-0');expect(values(c).attack).toBe(7);
});
it('suspends a held target after a manual magic bonus is added without overwriting either record',()=>{
 const {c}=activate();focus(c).entry.raw.bonusSpellAttack=4;const before=JSON.stringify(c);expect(values(c).attack).toBe(7);expect(evaluate(c).issues.some(issue=>issue.id.startsWith('infusion:'))).toBe(true);expect(JSON.stringify(c)).toBe(before);
});

it('does not elevate an unrelated item, infusion or class when only its mutable display name matches a reviewed identity',()=>{
 const itemState=arcaneFocusFixture(),crystal=focus(itemState.c,'focus-3');crystal.entry.name='Rod';expect(infusionTargets(itemState.c,itemState.entry).map(row=>row.id)).not.toContain(crystal.id);
 const optionState=arcaneFocusFixture();optionState.entry.english='Unreviewed Option';optionState.entry.name='Enhanced Arcane Focus';expect(infusionRule(optionState.entry)).toBeUndefined();
 const ownerState=arcaneFocusFixture(),owner=focus(ownerState.c,'infusion-owner');owner.entry.english='Unreviewed Class';owner.entry.name='Artificer';expect(()=>setInfusionTarget(ownerState.c,ownerState.choiceId,ownerState.entry.id,'focus-0')).toThrow(/未有效学习/);
});

import {applyInventory,type StockContainer} from '../src/core/inventory';
it('external inventory projections suspend immediately but preserve intent with an explicit manual reconfirmation boundary',()=>{
 const {c}=activate(),target=focus(c),stock:StockContainer={id:'external',name:'External',kind:'card',revision:1,columns:8,capacity:32,write:true,items:[{id:target.id,kind:'item',name:target.entry.name,entry:target.entry,quantity:1,slot:0,revision:1,equipped:true,attuned:false}]};
 applyInventory(c,stock);expect(values(c).attack).toBe(7);expect(c.infusions!.bindings[0].held).toBe(true);expect(evaluate(c).issues.some(issue=>issue.message.includes('外部背包／持手变化不自动清除旧的持握确认'))).toBe(true);
 stock.items[0].attuned=true;applyInventory(c,stock);expect(values(c).attack).toBe(8);expect(evaluate(c).trace.spellAttack.join(' ')).toContain('装备及同调后重新确认当前持握');
});
it('does not normalize old held intent away during unrelated edits or evaluations',()=>{
 const {c}=activate();focus(c).equipped=false;const before=structuredClone(c);c.spellSettings!.attackBonus=5;reconcileInfusionHolding(before,c);expect(c.infusions).toEqual(before.infusions);expect(values(c)).toEqual({attack:10,dc:16});
});

import {returningWeaponFixture} from './e2e/returningWeaponFixture';
import {infusionFixture} from './e2e/infusionFixture';
import {matchesReference} from '../src/core/entryReferences';
it.each([['Enhanced Defense',infusionFixture],['Enhanced Weapon',enhancedWeaponFixture],['Returning Weapon',returningWeaponFixture]] as const)('also rejects inherited display-only rule aliases for %s',(_name,fixture)=>{
 const {c,entry,choiceId}=fixture(),reference=`${entry.english}|${entry.source}`;entry.name=entry.english;entry.english='Unreviewed AI Option';entry.raw.ENG_name='Unreviewed AI Option';
 // The old infusionRule/owner route used this display-friendly matcher. Other
 // explicit learned/source/feature/progression gates are all still populated.
 expect(matchesReference(entry,reference)).toBe(true);expect(infusionRule(entry)).toBeUndefined();const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,entry.id,c.selections.find(row=>row.entry.kind==='item')!.id)).toThrow(/未有效学习/);expect(JSON.stringify(c)).toBe(before);
});
