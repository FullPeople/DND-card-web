import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Selection} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {evaluate} from '../src/core/engine';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {newAutomationState} from '../src/core/automation/state';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {exportLinkedOwlbear} from '../src/core/export';
import {readCharacter} from '../src/core/validation';

function character(){const c=newCharacter();c.automation=newAutomationState();c.abilities.str=18;c.abilities.dex=14;c.training={weapons:'简易武器、军用武器'};return c;}
function weapon(c:Character,raw:Record<string,unknown>={}):Selection{
 const [entry]=normalizeData({item:[{name:'原创长兵器',ENG_name:'Fixture Weapon',source:'XPHB',type:'M|XPHB',weaponCategory:'simple',dmg1:'1d6',dmg2:'1d8',property:['T|XPHB','V|XPHB'],dmgType:'P',...raw}]},'authored-test');
 const row={id:'weapon-'+c.selections.length,entry,quantity:1,level:1,equipped:true};c.selections.push(row);return row;
}
const report=(c:Character)=>automaticWeaponAttacks(c,evaluate(c));
describe('equipped weapon action projection',()=>{
 it('separates melee, thrown and versatile dice without multiplying damage by quantity',()=>{
  const c=character();weapon(c).quantity=12;const before=JSON.stringify(c);
  expect(report(c).attacks.map(a=>[a.modeLabel,a.attack_bonus,a.damage])).toEqual([['近战',6,'1d6+4'],['投掷',6,'1d6+4'],['双手',6,'1d8+4']]);expect(JSON.stringify(c)).toBe(before);
 });
 it('uses finesse consistently, and ranged thrown weapons have one attack',()=>{
  const c=character();c.abilities.dex=20;weapon(c,{property:['F','T'],type:'R'});
  expect(report(c).attacks.map(a=>[a.modeLabel,a.attack_bonus,a.damage])).toEqual([['投掷',7,'1d6+5']]);
  c.abilities.str=22;expect(report(c).attacks[0].damage).toBe('1d6+6');
 });
 it('does not add proficiency without training and handles negative ability damage',()=>{
  const c=character();c.training!.weapons='';c.abilities.str=8;weapon(c,{property:[]});
  expect(report(c).attacks[0]).toMatchObject({attack_bonus:-1,damage:'1d6-1'});expect(report(c).issues.some(i=>i.id.startsWith('weapon-training'))).toBe(true);
 });
 it('reads source-qualified named training and base-item identity without changing rules for names',()=>{
  const c=character();c.training!.weapons='{@item Fixture Weapon|XPHB|显示名}';const row=weapon(c,{property:[]});expect(report(c).attacks[0].attack_bonus).toBe(6);
  c.training!.weapons='Fixture Weapon|PHB';expect(report(c).attacks[0].attack_bonus).toBe(4);
  row.entry.raw.baseItem='basic fixture|XPHB';c.training!.weapons='basic fixture|XPHB';expect(report(c).attacks[0].attack_bonus).toBe(6);
 });
 it('tracks magic bonuses and attunement without adding proficiency to damage',()=>{
  const c=character(),row=weapon(c,{property:[],reqAttune:true,bonusWeapon:'+1',bonusWeaponAttack:2,bonusWeaponDamage:3});
  expect(report(c).attacks[0]).toMatchObject({attack_bonus:6,damage:'1d6+4'});row.attuned=true;
  expect(report(c).attacks[0]).toMatchObject({attack_bonus:9,damage:'1d6+8'});
  row.entry.raw.bonusWeapon='level/2';expect(report(c).attacks).toHaveLength(0);expect(report(c).issues.some(i=>i.message.includes('未支持'))).toBe(true);
 });
 it('withdraws actions on unequip, source disable, parent disable and deletion',()=>{
  const c=character(),row=weapon(c);expect(report(c).attacks).toHaveLength(3);row.equipped=false;expect(report(c).attacks).toHaveLength(0);row.equipped=true;
  c.profile.enabledSources=[];expect(report(c).attacks).toHaveLength(0);c.profile.enabledSources=['XPHB'];row.parentId='missing';expect(report(c).attacks).toHaveLength(0);
 });
 it('round trips full backup without stale projected attacks and preserves custom actions',()=>{
  const c=character(),row=weapon(c);c.quickbarActions=[{id:'manual',name:'手写打击',attack:'+9',damage:'2d8+7'}];
  const linked=exportLinkedOwlbear(c,evaluate(c));const restored=readCharacter(linked.dnd_card_web).character;restored.externalSnapshot=linked;
  expect(weaponAttacks(restored)).toHaveLength(4);restored.selections.find(s=>s.id===row.id)!.equipped=false;
  expect(weaponAttacks(restored).map(a=>a.key)).toEqual(['custom:manual']);
 });
 it('retains manual item formulas, and regular manual cards keep their prior projection',()=>{
  const c=character(),row=weapon(c,{attackBonus:'+11',dmg1:'2d8+9',property:[]});
  expect(weaponAttacks(c)[0]).toMatchObject({attack_bonus:'+11',damage:'2d8+9'});expect(weaponAttacks(c)).toHaveLength(1);
  row.equipped=false;expect(weaponAttacks(c)).toHaveLength(0);c.automation!.enabled=false;expect(weaponAttacks(c)[0].damage).toBe('2d8+9');
 });
 it('hides exactly one mode and never merges two copies of the same weapon',()=>{
  const c=character(),first=weapon(c);weapon(c);c.quickbarLayout={hidden:[`auto-weapon:${first.id}:thrown`],order:[]};expect(weaponAttacks(c)).toHaveLength(5);
 });
 it('does not infer an unrecorded starting weapon choice or promote a later class',()=>{
  const c=character();delete c.training;const row=weapon(c,{property:[]});
  const [first,second]=normalizeData({class:[{name:'原创甲',source:'XPHB',startingProficiencies:{weapons:[{choose:{from:['simple','martial'],count:1}}]}},{name:'原创乙',source:'XPHB',startingProficiencies:{weapons:['simple']},multiclassing:{proficienciesGained:{weapons:[]}}}]},'authored-test');
  c.selections.unshift({id:'first',entry:first,quantity:1,level:1,equipped:false},{id:'second',entry:second,quantity:1,level:1,equipped:false});
  c.profile.disabledEntries=[first.id];expect(report(c).attacks[0].attack_bonus).toBe(4);second.raw.multiclassing.proficienciesGained.weapons=['simple'];expect(report(c).attacks[0].attack_bonus).toBe(6);expect(row.equipped).toBe(true);
 });
});
