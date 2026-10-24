import {it,expect} from 'vitest';
import {evaluate} from '../src/core/engine';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {returningWeaponFixture} from './e2e/returningWeaponFixture';
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
function activate(){const state=returningWeaponFixture();setInfusionTarget(state.c,state.choiceId,state.entry.id,'weapon-0');return state;}

it('applies the explicit returning weapon binding to every supported attack mode',()=>{
 const {c,entry,choiceId}=returningWeaponFixture();c.infusions={version:1,bindings:[{choiceId,entryId:entry.id,targetId:'weapon-0'}]};
 const before=JSON.stringify(c),attacks=automaticWeaponAttacks(c,evaluate(c)).attacks;
 expect(attacks.map(row=>[row.modeLabel,row.attack_bonus,row.damage])).toEqual([['近战',6,'1d6+4'],['投掷',6,'1d6+4'],['双手',6,'1d8+4']]);expect(JSON.stringify(c)).toBe(before);
});

it('does not activate merely learned records and only offers explicit thrown weapons',()=>{
 const {c,entry,choiceId}=returningWeaponFixture(),before=JSON.stringify(c);
 expect(infusionTargets(c,entry).map(row=>row.id)).toEqual(['weapon-0','weapon-2']);expect(report(c).attacks[0].damage).toBe('1d6+3');
 expect(()=>setInfusionTarget(c,choiceId,entry.id,'weapon-1')).toThrow(/投掷属性/);expect(JSON.stringify(c)).toBe(before);
});

it.each([2,9,10,20])('keeps a fixed +1 at artificer level %i rather than inheriting Enhanced Weapon scaling',level=>{
 const {c}=activate();c.selections.find(row=>row.id==='infusion-owner')!.level=level;
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:evaluate(c).proficiency+4,damage:'1d6+4'});
});

it('supports ranged thrown weapons and preserves finesse and negative/manual ability choices',()=>{
 const {c,entry,choiceId}=activate();setInfusionTarget(c,choiceId,entry.id,'weapon-2');const dart=weapon(c,'weapon-2');dart.equipped=true;c.abilities.dex=18;
 expect(report(c).attacks.filter(row=>row.origin.selectionId===dart.id)).toMatchObject([{modeLabel:'投掷',attack_bonus:7,damage:'1d4+5'}]);
 dart.weaponAbility='wis';c.abilities.wis=8;c.training={weapons:''};expect(report(c).attacks.find(row=>row.origin.selectionId===dart.id)).toMatchObject({attack_bonus:0,damage:'1d4'});
});

it.each([
 ['missing property',(row:Selection):void=>{delete row.entry.raw.property;}],
 ['only display name',(row:Selection):void=>{row.entry.name='投掷回力武器';row.entry.raw.property=[];}],
 ['unknown property object',(row:Selection):void=>{row.entry.raw.property=[{type:'T'}];}],
 ['unreviewed category',(row:Selection):void=>{row.entry.raw.weaponCategory='improvised';}],
 ['magic item',(row:Selection):void=>{row.entry.raw.rarity='uncommon';}],
 ['stacked copies',(row:Selection):void=>{row.quantity=2;}],
 ['manual formula',(row:Selection):void=>{row.entry.raw.attackBonus='+13';}],
] as const)('rejects %s without changing any character state',(_label,change)=>{
 const {c,entry,choiceId}=returningWeaponFixture();change(weapon(c));const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,entry.id,'weapon-0')).toThrow();expect(JSON.stringify(c)).toBe(before);
});

it('uses structured qualified property codes and suspends when the thrown property is removed',()=>{
 const {c,entry,choiceId}=returningWeaponFixture();weapon(c).entry.raw.property=['T|PHB','V|PHB'];setInfusionTarget(c,choiceId,entry.id,'weapon-0');expect(report(c).attacks[0].damage).toBe('1d6+4');
 weapon(c).entry.raw.property=['V'];expect(report(c).attacks[0].damage).toBe('1d6+3');expect(c.infusions!.bindings).toHaveLength(1);
 weapon(c).entry.raw.property=['T','V'];expect(report(c).attacks[0].damage).toBe('1d6+4');
});

it('saves and reopens native and linked backups without retaining stale generated bonuses after withdrawal',()=>{
 const {c,entry,choiceId}=activate();c.runtime.resources.ammo={max:10,current:2};const items=JSON.stringify(c.selections),runtime=JSON.stringify(c.runtime),manual=JSON.stringify(c.quickbarActions);
 for(const file of [exportCharacter(c),exportLinkedOwlbear(c,evaluate(c))]){
  const restored=readCharacter('character' in file?file:file.dnd_card_web).character;if(!('character' in file))restored.externalSnapshot=file;
  expect(weaponAttacks(restored)).toHaveLength(4);expect(report(restored).attacks[0]).toMatchObject({attack_bonus:6,damage:'1d6+4'});
  setInfusionTarget(restored,choiceId,entry.id,null);expect(report(restored).attacks[0]).toMatchObject({attack_bonus:5,damage:'1d6+3'});
  expect(JSON.stringify(restored.selections)).toBe(items);expect(JSON.stringify(restored.runtime)).toBe(runtime);expect(JSON.stringify(restored.quickbarActions)).toBe(manual);
 }
});

it('replaces one target instance without equipping, moving, restoring, or infusing its copies',()=>{
 const {c,entry,choiceId}=activate();c.inventory={view:'grid',order:['weapon-0','weapon-2'],positions:{'weapon-0':7,'weapon-2':3},attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:5,pp:0}};
 c.selections.push({...structuredClone(weapon(c)),id:'weapon-copy'});const inventory=JSON.stringify(c.inventory);
 expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([6,6,6,5,5,5]);
 setInfusionTarget(c,choiceId,entry.id,'weapon-2');expect(weapon(c,'weapon-2').equipped).toBe(false);expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([5,5,5,5,5,5]);
 weapon(c,'weapon-2').equipped=true;expect(report(c).attacks.find(row=>row.origin.selectionId==='weapon-2')).toMatchObject({attack_bonus:6,damage:'1d4+4'});
 expect(JSON.stringify(c.inventory)).toBe(inventory);expect(weapon(c,'weapon-2').quantity).toBe(1);expect(weapon(c).quantity).toBe(1);
});

it('does not stack source-qualified duplicates that arrived under different imported IDs',()=>{
 const {c,entry,choiceId}=activate(),copy=structuredClone(entry);copy.id+=':other-import';c.classChoiceSnapshots![copy.id]=copy;c.answers[choiceId].push(copy.id);weapon(c,'weapon-2').equipped=true;
 const before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,copy.id,'weapon-2')).toThrow(/同一注法/);expect(JSON.stringify(c)).toBe(before);
 c.infusions!.bindings.push({choiceId,entryId:copy.id,targetId:'weapon-2'});expect(report(c).attacks.map(row=>row.attack_bonus)).toEqual([5,5,5,5]);
});

it('shares the item reservation and capacity with other infusions without silently replacing them',()=>{
 const {c,entry,choiceId,enhanced,defense}=activate();c.classChoiceSnapshots![enhanced.id]=enhanced;c.classChoiceSnapshots![defense.id]=defense;c.answers[choiceId].push(enhanced.id,defense.id);
 let before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,enhanced.id,'weapon-0')).toThrow(/这件物品已有注法/);expect(JSON.stringify(c)).toBe(before);
 setInfusionTarget(c,choiceId,enhanced.id,'weapon-1');before=JSON.stringify(c);expect(()=>setInfusionTarget(c,choiceId,defense.id,'infusion-item-0')).toThrow(/上限/);expect(JSON.stringify(c)).toBe(before);
 setInfusionTarget(c,choiceId,entry.id,null);setInfusionTarget(c,choiceId,defense.id,'infusion-item-0');expect(c.infusions!.bindings.map(row=>row.entryId)).toEqual([enhanced.id,defense.id]);
 expect(report(c).attacks[0].damage).toBe('1d6+3');expect(evaluate(c).ac).toBe(16);
});

it('invalid imported target conflicts suspend both infusions instead of adding them',()=>{
 const {c,choiceId,enhanced}=activate();c.classChoiceSnapshots![enhanced.id]=enhanced;c.answers[choiceId].push(enhanced.id);c.infusions!.bindings.push({choiceId,entryId:enhanced.id,targetId:'weapon-0'});
 expect(report(c).attacks[0]).toMatchObject({attack_bonus:5,damage:'1d6+3'});expect(evaluate(c).issues.filter(issue=>issue.id.startsWith('infusion:'))).toHaveLength(2);
});

it('protects hand-written attacks and item bonuses changed after activation',()=>{
 const {c}=activate(),row=weapon(c);row.entry.raw.attackBonus='+13';row.entry.raw.dmg1='2d8+9';const before=JSON.stringify(c);
 expect(weaponAttacks(c).find(attack=>attack.key.startsWith('selection:'))).toMatchObject({attack_bonus:'+13',damage:'2d8+9'});expect(weaponAttacks(c).find(attack=>attack.key==='custom:manual')).toMatchObject({attack_bonus:'+12',damage:'3d6+8'});expect(JSON.stringify(c)).toBe(before);
 delete row.entry.raw.attackBonus;row.entry.raw.dmg1='1d6';row.entry.raw.bonusWeapon='+2';expect(report(c).attacks[0]).toMatchObject({attack_bonus:7,damage:'1d6+5'});expect(c.infusions!.bindings).toHaveLength(1);
});

it.each(['source','option','feature','owner','target','automation'] as const)('retains the binding but stops derived effects while %s is disabled',mode=>{
 const {c,entry}=activate(),before=JSON.stringify(c.infusions);
 if(mode==='source')c.profile.enabledSources=['PHB'];else if(mode==='automation')c.automation!.enabled=false;
 else c.profile.disabledEntries=[mode==='option'?entry.id:c.selections.find(row=>row.id===(mode==='feature'?'infusion-feature':mode==='owner'?'infusion-owner':'weapon-0'))!.entry.id];
 expect(report(c).attacks.every(row=>!row.trace.some(line=>line.includes('注法 +')))).toBe(true);expect(JSON.stringify(c.infusions)).toBe(before);
 c.profile.enabledSources=['PHB','TCE'];c.profile.disabledEntries=[];c.automation!.enabled=true;expect(report(c).attacks[0].damage).toBe('1d6+4');
});

it('forgets through the real choice transaction, and relearning never revives the withdrawn target',()=>{
 const {c,entry,choiceId,entries}=activate(),items=JSON.stringify(c.selections);setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);expect(report(c).attacks[0].damage).toBe('1d6+3');
 setSheetChoiceSlot(c,choiceId,0,entry.id,entries);expect(report(c).attacks[0].damage).toBe('1d6+3');expect(JSON.stringify(c.selections)).toBe(items);
});

it('requires a reviewed source identity rather than the translated display label',()=>{
 for(const change of [(entry:any)=>{entry.source='ERLW';},(entry:any)=>{entry.english='Unreviewed';entry.raw.ENG_name='Unreviewed';},(entry:any)=>{entry.raw.featureType=['AI','OTHER'];}]){
  const {c,entry,choiceId}=returningWeaponFixture();change(entry);expect(infusionRule(entry)).toBeUndefined();expect(()=>setInfusionTarget(c,choiceId,entry.id,'weapon-0')).toThrow();
 }
 const {c,entry,choiceId}=returningWeaponFixture();entry.name='改过显示标签';setInfusionTarget(c,choiceId,entry.id,'weapon-0');expect(report(c).attacks[0].damage).toBe('1d6+4');
});

it('makes the manual return-to-hand boundary visible in controls consumers and exports without inventing state transitions',()=>{
 const {c}=activate(),before=JSON.stringify(c),d=evaluate(c);
 expect(d.issues.some(issue=>issue.id.startsWith('infusion-effect-boundary:')&&issue.message.includes('未记录持手／投出状态'))).toBe(true);
 expect(report(c).attacks[0].trace.join(' ')).toContain('不会自动移动物品或结算回手');expect(exportLinkedOwlbear(c,d).export_warnings.join(' ')).toContain('回到持用者手中的动作仍需手动处理');expect(JSON.stringify(c)).toBe(before);
});

const sourceDir=process.env.INFUSION_SOURCE_DIR,frozenDir=process.env.INFUSION_FROZEN_DIR;
it.skipIf(!sourceDir)('replays frozen Returning Weapon through learning, explicit activation, unchanged level-ten bonus, save/reopen, replace and revoke',()=>{
 const optional=JSON.parse(readFileSync(`${sourceDir}/optionalfeatures-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),classes=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8'));
 const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');expect(hash(optional)).toBe('031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844');expect(hash(classes)).toBe('c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7');
 expect(hash(optional.optionalfeature.find((row:any)=>row.ENG_name==='Returning Weapon'&&row.source==='TCE'))).toBe('9b06dce9d856241dbc2fb57fe7b95a4945abee3cee21f969a102540fd83a4aa7');
 const entries=normalizeData({...classes,...optional},'frozen-returning-weapon'),entry=entries.find(row=>row.source==='TCE'&&row.english==='Returning Weapon')!,owner=entries.find(row=>row.kind==='class'&&row.source==='TCE'&&row.english==='Artificer')!;
 const {c}=returningWeaponFixture();c.selections.find(row=>row.id==='infusion-owner')!.entry=owner;c.selections.find(row=>row.id==='infusion-feature')!.entry=entries.find(row=>row.raw._category==='classFeature'&&row.source==='TCE'&&row.english==='Infuse Item')!;c.answers={};c.classChoiceSnapshots={};
 const choice=sheetChoices(c,entries).find(row=>row.ownerId==='infusion-owner'&&row.options.some(option=>option.entry.id===entry.id))!;expect(choice).toBeDefined();setSheetChoiceSlot(c,choice.id,0,entry.id,entries);expect(report(c).attacks[0].damage).toBe('1d6+3');
 setInfusionTarget(c,choice.id,entry.id,'weapon-0');expect(report(c).attacks[0].damage).toBe('1d6+4');const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections.find(row=>row.id==='infusion-owner')!.level=10;expect(report(restored).attacks[0].damage).toBe('1d6+4');
 setInfusionTarget(restored,choice.id,entry.id,'weapon-2');weapon(restored,'weapon-2').equipped=true;expect(report(restored).attacks.find(row=>row.origin.selectionId==='weapon-2')).toMatchObject({attack_bonus:8,damage:'1d4+4'});expect(report(restored).attacks[0].damage).toBe('1d6+3');
 setInfusionTarget(restored,choice.id,entry.id,null);expect(report(restored).attacks.find(row=>row.origin.selectionId==='weapon-2')).toMatchObject({attack_bonus:7,damage:'1d4+3'});
});

it.skipIf(!frozenDir)('checks all thrown PHB weapon structures in the frozen base items without inventing Net damage',()=>{
 const index=JSON.parse(readFileSync(`${frozenDir}/index.json`,'utf8')),input=index.rows.find((row:any)=>row.url==='https://5e.kiwee.top/data/items-base.json'),data=JSON.parse(readFileSync(`${frozenDir}/${input.path}`,'utf8'));
 expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe('8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff');
 const {c,entry,choiceId}=returningWeaponFixture();c.selections=c.selections.filter(row=>row.entry.kind!=='item');const items=normalizeData(data,'frozen-returning-items').filter(row=>row.kind==='item'&&row.source==='PHB'&&['simple','martial'].includes(row.raw.weaponCategory)&&row.raw.property?.includes('T'));expect(items).toHaveLength(8);
 c.selections.push(...items.map((entry,index)=>({id:`frozen-thrown-${index}`,entry,quantity:1,level:1,equipped:false})));
 const targets=infusionTargets(c,entry);expect(targets).toHaveLength(7);expect(items.filter(item=>!targets.some(row=>row.entry.id===item.id)).map(item=>item.english)).toEqual(['Net']);
 for(const target of targets){target.equipped=true;setInfusionTarget(c,choiceId,entry.id,target.id);const attacks=report(c).attacks.filter(attack=>attack.origin.selectionId===target.id);expect(attacks.length).toBeGreaterThan(0);expect(attacks.every(attack=>attack.attack_bonus===6&&attack.trace.some(line=>line.includes('注法 +1')))).toBe(true);target.equipped=false;}
});
