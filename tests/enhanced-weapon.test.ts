import {it,expect} from 'vitest';
import {evaluate} from '../src/core/engine';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {enhancedWeaponFixture} from './e2e/enhancedWeaponFixture';
import {infusionRule,infusionTargets,setInfusionTarget} from '../src/core/automation/infusions';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {normalizeData} from '../src/data/catalog';
import type {Character,Selection} from '../src/core/model';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const report=(c:Character)=>automaticWeaponAttacks(c,evaluate(c));
const weapon=(c:Character,id='weapon-0')=>c.selections.find(row=>row.id===id)!;
function activate(){const state=enhancedWeaponFixture();setInfusionTarget(state.c,state.choiceId,state.entry.id,'weapon-0');return state;}

// Same explicit binding on the pre-change baseline produces +5 / 1d6+3.
// Learning, activation and automatic attack projection are separate contracts.
it('applies enhanced weapon to melee, thrown and versatile attacks without changing the source item',()=>{
 const {c,entry,choiceId}=enhancedWeaponFixture();
 c.infusions={version:1,bindings:[{choiceId,entryId:entry.id,targetId:'weapon-0'}]};
 const before=JSON.stringify(c),attacks=automaticWeaponAttacks(c,evaluate(c)).attacks;
 expect(attacks.map(row=>[row.modeLabel,row.attack_bonus,row.damage])).toEqual([['近战',6,'1d6+4'],['投掷',6,'1d6+4'],['双手',6,'1d8+4']]);
 expect(JSON.stringify(c)).toBe(before);
});

it('requires explicit activation and filters targets for the selected infusion',()=>{
 const {c,entry,choiceId,defense}=enhancedWeaponFixture(),before=JSON.stringify(c);
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:5,damage:'1d6+3'});
 expect(infusionTargets(c,entry).map(row=>row.id)).toEqual(['weapon-0','weapon-1']);
 expect(infusionTargets(c,defense).map(row=>row.id)).toEqual(['infusion-item-0','infusion-item-1']);
 expect(()=>setInfusionTarget(c,choiceId,entry.id,'infusion-item-0')).toThrow(/简易或军用武器/);
 expect(JSON.stringify(c)).toBe(before);
});

it('upgrades at artificer level ten rather than total multiclass level',()=>{
 const {c}=activate(),owner=c.selections.find(row=>row.id==='infusion-owner')!;
 c.selections.push({id:'other-class',entry:normalizeData({class:[{name:'另一个职业',source:'PHB'}]},'authored')[0],level:8,quantity:1,equipped:false});
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:8,damage:'1d6+4'});
 owner.level=9;expect(report(c).attacks[0].damage).toBe('1d6+4');
 owner.level=10;expect(report(c).attacks[0]).toMatchObject({attack_bonus:11,damage:'1d6+5'});
 owner.level=1;expect(report(c).attacks[0].damage).toBe('1d6+3');expect(c.infusions!.bindings).toHaveLength(1);
});

it('reopens native and linked backups without duplicating projected bonuses, and revocation removes only the owned effect',()=>{
 const {c,choiceId,entry}=activate();c.runtime.resources.ammo={max:10,current:2};c.notes='手写内容保留';
 const equipment=JSON.stringify(c.selections),manual=JSON.stringify(c.quickbarActions),runtime=JSON.stringify(c.runtime);
 for(const file of [exportCharacter(c),exportLinkedOwlbear(c,evaluate(c))]){
  const restored=readCharacter('character' in file?file:file.dnd_card_web).character;
  if(!('character' in file))restored.externalSnapshot=file;
  expect(report(restored).attacks[0]).toMatchObject({attack_bonus:6,damage:'1d6+4'});
  expect(weaponAttacks(restored)).toHaveLength(4);
  setInfusionTarget(restored,choiceId,entry.id,null);
  expect(report(restored).attacks[0]).toMatchObject({attack_bonus:5,damage:'1d6+3'});
  expect(JSON.stringify(restored.selections)).toBe(equipment);expect(JSON.stringify(restored.quickbarActions)).toBe(manual);expect(JSON.stringify(restored.runtime)).toBe(runtime);expect(restored.notes).toBe(c.notes);
 }
});

it('replaces the target without auto-equipping, binding an entry identity, or leaving a bonus on the old item',()=>{
 const {c,choiceId,entry}=activate();setInfusionTarget(c,choiceId,entry.id,'weapon-1');
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:5,damage:'1d6+3'});expect(weapon(c,'weapon-1').equipped).toBe(false);
 weapon(c,'weapon-1').equipped=true;expect(report(c).attacks.at(-1)).toMatchObject({attack_bonus:5,damage:'1d8+3'});
 weapon(c,'weapon-1').equipped=false;expect(report(c).attacks).toHaveLength(3);expect(c.infusions!.bindings).toHaveLength(1);
});

it('owns a selection instance, not all copies of the same source item',()=>{
 const {c}=activate();c.selections.push({...structuredClone(weapon(c)),id:'copy'});
 expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([6,6,6,5,5,5]);
 c.selections=c.selections.filter(row=>row.id!=='weapon-0');expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([5,5,5]);expect(c.infusions!.bindings).toHaveLength(1);
});

it.each([
 ['missing rarity',(row:Selection):void=>{delete row.entry.raw.rarity;}],
 ['magical rarity',(row:Selection):void=>{row.entry.raw.rarity='uncommon';}],
 ['magic flag',(row:Selection):void=>{row.entry.raw.magic=true;}],
 ['attunement',(row:Selection):void=>{row.entry.raw.reqAttune=true;}],
 ['manual bonus',(row:Selection):void=>{row.entry.raw.bonusWeapon='+2';}],
 ['manual attack',(row:Selection):void=>{row.entry.raw.attackBonus='+13';}],
 ['unresolved copy',(row:Selection):void=>{row.entry.raw._copy={};}],
 ['effects',(row:Selection):void=>{row.entry.effects=[{op:'add',target:'ac',value:1}];}],
 ['stack',(row:Selection):void=>{row.quantity=2;}],
 ['unknown category',(row:Selection):void=>{row.entry.raw.weaponCategory='improvised';}],
 ['unknown dice',(row:Selection):void=>{row.entry.raw.dmg1='按情况裁定';}],
 ['unknown versatile dice',(row:Selection):void=>{row.entry.raw.dmg2='special';}],
] as const)('rejects %s targets transactionally',(_label,change)=>{
 const {c,choiceId,entry}=enhancedWeaponFixture();change(weapon(c));const before=JSON.stringify(c);
 expect(()=>setInfusionTarget(c,choiceId,entry.id,'weapon-0')).toThrow();expect(JSON.stringify(c)).toBe(before);
});

it('suspends the infusion after a manual weapon change while preserving manual attack, damage, custom actions and source bonuses',()=>{
 const {c}=activate(),row=weapon(c);row.entry.raw.attackBonus='+13';row.entry.raw.dmg1='2d8+9';
 const before=JSON.stringify(c);expect(weaponAttacks(c).find(attack=>attack.key.startsWith('selection:'))).toMatchObject({attack_bonus:'+13',damage:'2d8+9'});
 expect(weaponAttacks(c).find(attack=>attack.key==='custom:manual')).toMatchObject({attack_bonus:'+12',damage:'3d6+8'});
 expect(report(c).attacks).toEqual([]);expect(JSON.stringify(c)).toBe(before);
 delete row.entry.raw.attackBonus;row.entry.raw.dmg1='1d6';row.entry.raw.bonusWeapon='+3';
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:8,damage:'1d6+6'});expect(c.infusions!.bindings).toHaveLength(1);expect(row.entry.raw.bonusWeapon).toBe('+3');
});

it('adds the infusion after a per-instance ability choice without granting proficiency or refilling resources',()=>{
 const {c}=activate();weapon(c).weaponAbility='wis';c.abilities.wis=8;c.training={weapons:''};c.runtime.resources.ammo={max:10,current:1};
 const before=JSON.stringify(c);expect(report(c).attacks[0]).toMatchObject({attack_bonus:0,damage:'1d6'});expect(JSON.stringify(c)).toBe(before);
});

it.each(['source','option','feature','owner','target','automation'] as const)('suspends and resumes without deleting intent when %s is disabled',mode=>{
 const {c,entry}=activate(),before=JSON.stringify(c.infusions);
 if(mode==='source')c.profile.enabledSources=['PHB'];
 else if(mode==='automation')c.automation!.enabled=false;
 else c.profile.disabledEntries=[mode==='option'?entry.id:c.selections.find(row=>row.id===(mode==='feature'?'infusion-feature':mode==='owner'?'infusion-owner':'weapon-0'))!.entry.id];
 expect(report(c).attacks.every(row=>!row.trace.some(line=>line.includes('注法 +')))).toBe(true);expect(JSON.stringify(c.infusions)).toBe(before);
 c.profile.enabledSources=['PHB','TCE'];c.profile.disabledEntries=[];c.automation!.enabled=true;
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:6,damage:'1d6+4'});
});

it('prevents duplicate source-qualified infusions with different imported entry IDs from stacking or reserving a second item',()=>{
 const {c,entry,choiceId}=activate(),duplicate=structuredClone(entry);duplicate.id+=':second-import';
 c.classChoiceSnapshots![duplicate.id]=duplicate;c.answers[choiceId].push(duplicate.id);weapon(c,'weapon-1').equipped=true;
 const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,duplicate.id,'weapon-1')).toThrow(/同一注法/);expect(JSON.stringify(c)).toBe(before);
 c.infusions!.bindings.push({choiceId,entryId:duplicate.id,targetId:'weapon-1'});
 expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([5,5,5,4]);expect(evaluate(c).issues.filter(issue=>issue.id.startsWith('infusion:'))).toHaveLength(2);
});

it('coexists with enhanced defense while retaining independent targets and one shared infusion capacity',()=>{
 const {c,entry,defense,choiceId}=activate();c.classChoiceSnapshots![defense.id]=defense;c.answers[choiceId].push(defense.id);
 setInfusionTarget(c,choiceId,defense.id,'infusion-item-0');expect(evaluate(c).ac).toBe(16);expect(report(c).attacks[0].attack_bonus).toBe(6);
 setInfusionTarget(c,choiceId,entry.id,null);expect(evaluate(c).ac).toBe(16);expect(report(c).attacks[0].attack_bonus).toBe(5);
 expect(c.infusions!.bindings.map(row=>row.entryId)).toEqual([defense.id]);
});

it('forgets through the actual learning transaction, and relearning does not reactivate',()=>{
 const {c,choiceId,entry,entries}=activate(),before=JSON.stringify(c.selections);
 setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);expect(report(c).attacks[0].attack_bonus).toBe(5);
 setSheetChoiceSlot(c,choiceId,0,entry.id,entries);expect(report(c).attacks[0].attack_bonus).toBe(5);expect(JSON.stringify(c.selections)).toBe(before);
});

it('does not dispatch by a display name, wrong source, or unsupported entry structure',()=>{
 for(const change of [(entry:any)=>entry.source='ERLW',(entry:any)=>{entry.english='Unreviewed';entry.raw.ENG_name='Unreviewed';},(entry:any)=>entry.raw._copy={},(entry:any)=>entry.raw.featureType.push('OTHER')]){
  const {c,entry,choiceId}=enhancedWeaponFixture();change(entry);expect(infusionRule(entry)).toBeUndefined();expect(()=>setInfusionTarget(c,choiceId,entry.id,'weapon-0')).toThrow();
 }
 const {c,entry,choiceId}=enhancedWeaponFixture();entry.name='自选显示名';setInfusionTarget(c,choiceId,entry.id,'weapon-0');expect(report(c).attacks[0].attack_bonus).toBe(6);
});

it('declares the magical-weapon boundary in derived warnings, attack traces and exports without mutating item flags',()=>{
 const {c}=activate(),row=weapon(c),d=evaluate(c);
 expect(d.issues.some(issue=>issue.id.startsWith('infusion-magic-boundary:')&&issue.message.includes('抵抗、免疫'))).toBe(true);
 expect(report(c).attacks[0].trace.join(' ')).toContain('攻击投影不自动裁定');
 expect(exportLinkedOwlbear(c,d).export_warnings.join(' ')).toContain('抵抗、免疫');expect(row.entry.raw.magic).toBeUndefined();expect(row.entry.raw.bonusWeapon).toBeUndefined();
 expect(d.trace.ac.join(' ')).not.toContain('增强武器');
});

const sourceDir=process.env.INFUSION_SOURCE_DIR;
const frozenDir=process.env.INFUSION_FROZEN_DIR;
it.skipIf(!frozenDir)('uses the exact frozen base-weapon structures and leaves unsupported no-damage or focus-type targets manual',()=>{
 const index=JSON.parse(readFileSync(`${frozenDir}/index.json`,'utf8')),input=index.rows.find((row:any)=>row.url==='https://5e.kiwee.top/data/items-base.json');expect(input).toBeDefined();
 const data=JSON.parse(readFileSync(`${frozenDir}/${input.path}`,'utf8'));
 expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe('8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff');
 const {c,entry,choiceId}=enhancedWeaponFixture();c.selections=c.selections.filter(row=>row.entry.kind!=='item');
 const items=normalizeData(data,'frozen-base-items').filter(row=>row.kind==='item'&&row.source==='PHB'&&['simple','martial'].includes(row.raw.weaponCategory));expect(items).toHaveLength(39);
 c.selections.push(...items.map((entry,index)=>({id:`frozen-weapon-${index}`,entry,quantity:1,level:1,equipped:false})));
 const targets=infusionTargets(c,entry);expect(targets).toHaveLength(36);
 expect(items.filter(item=>!targets.some(row=>row.entry.id===item.id)).map(item=>item.english)).toEqual(['Net','Staff','Wooden Staff']);
 const spear=targets.find(row=>row.entry.english==='Spear')!,bow=targets.find(row=>row.entry.english==='Longbow')!;
 spear.equipped=true;setInfusionTarget(c,choiceId,entry.id,spear.id);expect(report(c).attacks.map(row=>[row.attack_bonus,row.damage])).toEqual([[6,'1d6+4'],[6,'1d6+4'],[6,'1d8+4']]);
 setInfusionTarget(c,choiceId,entry.id,bow.id);bow.equipped=true;expect(report(c).attacks.find(row=>row.origin.selectionId===bow.id)).toMatchObject({attack_bonus:5,damage:'1d8+3'});
});
it.skipIf(!sourceDir)('replays the exact frozen Enhanced Weapon source through learning, activation, level scaling, save/reopen, replace and revoke',()=>{
 const optional=JSON.parse(readFileSync(`${sourceDir}/optionalfeatures-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),classes=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8'));
 const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 expect(hash(optional)).toBe('031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844');expect(hash(classes)).toBe('c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7');
 expect(hash(optional.optionalfeature.find((row:any)=>row.ENG_name==='Enhanced Weapon'&&row.source==='TCE'))).toBe('689d4e421ac5d106c43c8e90cd9b25b6a568e67c778a1a97e6d33ef34e7baddd');
 const entries=normalizeData({...classes,...optional},'frozen-20261022'),owner=entries.find(row=>row.kind==='class'&&row.source==='TCE'&&row.english==='Artificer')!,entry=entries.find(row=>row.source==='TCE'&&row.english==='Enhanced Weapon')!;
 const {c}=enhancedWeaponFixture();c.selections.find(row=>row.id==='infusion-owner')!.entry=owner;c.selections.find(row=>row.id==='infusion-feature')!.entry=entries.find(row=>row.raw._category==='classFeature'&&row.source==='TCE'&&row.english==='Infuse Item')!;c.answers={};c.classChoiceSnapshots={};
 const choice=sheetChoices(c,entries).find(row=>row.ownerId==='infusion-owner'&&row.options.some(option=>option.entry.id===entry.id))!;expect(choice).toBeDefined();
 setSheetChoiceSlot(c,choice.id,0,entry.id,entries);expect(report(c).attacks[0].damage).toBe('1d6+3');setInfusionTarget(c,choice.id,entry.id,'weapon-0');expect(report(c).attacks[0].damage).toBe('1d6+4');
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections.find(row=>row.id==='infusion-owner')!.level=10;expect(report(restored).attacks[0].damage).toBe('1d6+5');
 setInfusionTarget(restored,choice.id,entry.id,'weapon-1');expect(report(restored).attacks[0].damage).toBe('1d6+3');weapon(restored,'weapon-1').equipped=true;expect(report(restored).attacks.at(-1)!.damage).toBe('1d8+4');
 setInfusionTarget(restored,choice.id,entry.id,null);expect(report(restored).attacks.at(-1)!.damage).toBe('1d8+2');
});
