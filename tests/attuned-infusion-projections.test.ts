import {it,expect} from 'vitest';
import {enhancedWeaponFixture} from './e2e/enhancedWeaponFixture';
import {evaluate} from '../src/core/engine';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear,exportReview} from '../src/core/export';
import {readCharacter,importOwlbear} from '../src/core/validation';
import type {Character} from '../src/core/model';

function fixture(kind='Repeating Shot'){
 const {c,entry,choiceId}=enhancedWeaponFixture();
 entry.name=kind;entry.english=kind;entry.raw.ENG_name=kind;
 c.selections[0].level=6;
 const target=c.selections.find(row=>row.id===(kind==='Resistant Armor'?'infusion-item-0':kind==='Repulsion Shield'?'infusion-item-1':'weapon-1'))!;
 target.equipped=true;target.attuned=true;
 c.runtime.resources.ammo={current:2,max:20};
 c.infusions={version:1,bindings:[{choiceId,entryId:entry.id,targetId:target.id,...(kind==='Resistant Armor'?{damageType:'fire'}:{}),...(kind==='Repulsion Shield'?{held:true}:{})}]};
 return {c,entry,choiceId,target};
}
const attack=(c:Character)=>automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.origin.selectionId==='weapon-1')!;
it('adds a fixed repeating-shot bonus only to the ordinary ranged mode, without ammo or resource writes',()=>{
 const {c}=fixture();const before=JSON.stringify(c);
 expect(attack(c)).toMatchObject({modeLabel:'远程',attack_bonus:6,damage:'1d8+3'});
 expect(exportOwlbear(c,evaluate(c)).combat.weapons.find(row=>row.web_action_key==='auto-weapon:weapon-1:main')).toMatchObject({attack_bonus:6,damage:'1d8+3'});
 expect(JSON.stringify(c)).toBe(before);
 c.selections[0].level=10;expect(attack(c)).toMatchObject({attack_bonus:7,damage:'1d8+3'});
});
it.each([['R',['A','T']],['M',['A','T','V']]] as const)('does not apply ranged-only infusion to %s thrown, melee or two-handed modes', (type,properties)=>{
 const {c,target}=fixture();target.entry.raw.type=type;target.entry.raw.property=[...properties];target.entry.raw.dmg2='1d10';
 const attacks=automaticWeaponAttacks(c,evaluate(c)).attacks.filter(row=>row.origin.selectionId===target.id);
 expect(attacks.length).toBe(type==='R'?1:3);
 expect(attacks.every(row=>row.attack_bonus===(type==='R'?5:6))).toBe(true);
 expect(attacks.every(row=>!row.trace.some(line=>line.includes('注法 +1')))).toBe(true);
});
it('suspends and restores attunement, equipment, source and automation without changing stored intent',()=>{
 const {c,target}=fixture();const saved=JSON.stringify(c.infusions);
 target.attuned=false;expect(attack(c).damage).toBe('1d8+2');target.attuned=true;expect(attack(c).damage).toBe('1d8+3');
 target.equipped=false;expect(attack(c)).toBeUndefined();target.equipped=true;
 c.profile.enabledSources=['PHB'];expect(attack(c).damage).toBe('1d8+2');c.profile.enabledSources=['PHB','TCE'];expect(attack(c).damage).toBe('1d8+3');
 c.automation!.enabled=false;expect(attack(c)).toBeUndefined();c.automation!.enabled=true;expect(attack(c).damage).toBe('1d8+3');expect(JSON.stringify(c.infusions)).toBe(saved);
});
it('preserves manual attack formulas and applies raw magic once after suspending the infusion',()=>{
 const {c,target}=fixture();target.entry.raw.attackBonus='+17';target.entry.raw.dmg1='2d8+9';
 expect(attack(c)).toBeUndefined();expect(weaponAttacks(c).find(row=>row.entry?.id===target.entry.id)).toMatchObject({attack_bonus:'+17',damage:'2d8+9'});
 delete target.entry.raw.attackBonus;target.entry.raw.dmg1='1d8';target.entry.raw.bonusWeapon='+2';target.entry.raw.bonusWeaponAttack='+1';target.entry.raw.bonusWeaponDamage='+3';
 expect(attack(c)).toMatchObject({attack_bonus:8,damage:'1d8+7'});expect(c.infusions!.bindings).toHaveLength(1);
});
it('projects resistance and its trace, not AC, HP, manual notes or damage application',()=>{
 const {c,target}=fixture('Resistant Armor');c.notes='手写抗性：寒冷';target.entry.raw.resist=['cold'];const before=JSON.stringify(c),d=evaluate(c);
 expect(d.resistances).toEqual(['fire']);expect(d.trace.resistances.join(' ')).toContain('Resistant Armor');expect(d.ac).toBe(15);expect(c.runtime.hp).toBe(3);expect(JSON.stringify(c)).toBe(before);
 target.attuned=false;expect(evaluate(c).resistances).toEqual([]);target.attuned=true;expect(evaluate(c).resistances).toEqual(['fire']);
 c.profile.enabledSources=['PHB'];expect(evaluate(c).resistances).toEqual([]);c.profile.enabledSources=['TCE','PHB'];expect(evaluate(c).resistances).toEqual(['fire']);
});
it('does not infer unsupported or manual resistance types',()=>{
 const {c}=fixture('Resistant Armor');(c.infusions!.bindings[0] as any).damageType='bludgeoning';expect(evaluate(c).resistances).toEqual([]);
 delete (c.infusions!.bindings[0] as any).damageType;expect(evaluate(c).resistances).toEqual([]);
 c.infusions=undefined;c.notes='免疫火焰，抗性寒冷';expect(evaluate(c).resistances).toEqual([]);
});
it('keeps repulsion shield bonus fixed and gated by held confirmation and attunement',()=>{
 const {c,target,entry,choiceId}=fixture('Repulsion Shield');expect(evaluate(c).ac).toBe(18);
 c.selections[0].level=10;expect(evaluate(c).ac).toBe(18);
 setInfusionHeld(c,choiceId,entry.id,false);expect(evaluate(c).ac).toBe(17);setInfusionHeld(c,choiceId,entry.id,true);expect(evaluate(c).ac).toBe(18);
 target.attuned=false;expect(evaluate(c).ac).toBe(17);
});
it('makes resistance readable in review and warnings without changing unverified Owlbear defenses',()=>{
 const {c}=fixture('Resistant Armor'),d=evaluate(c),legacy=exportOwlbear(c,d),review=exportReview(c,d);
 expect(review).toContain('fire');expect(review).toContain('伤害结算仍需手动');
 expect(legacy.defenses).toEqual({resistances:[],immunities:[],advantages:[],disadvantages:[]});
 expect(legacy.export_warnings.some(line=>line.includes('fire')&&line.includes('伤害结算仍需手动'))).toBe(true);
 c.profile.enabledSources=['PHB'];const suspended=evaluate(c);expect(exportReview(c,suspended)).not.toContain('<h2>已核对的自动抗性</h2>');expect(exportOwlbear(c,suspended).export_warnings.some(line=>line.startsWith('已核对的自动抗性：'))).toBe(false);
});
it.each(['Repeating Shot','Repulsion Shield','Resistant Armor'])('round trips %s bindings exactly through native and linked backups without changing manual fields',kind=>{
 const {c,choiceId,entry}=fixture(kind);const before=JSON.stringify(c);
 for(const restored of [readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character,importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c)))))]){
  expect(restored).toEqual(c);expect(restored.infusions).toEqual(c.infusions);expect(restored.selections).toEqual(c.selections);expect(restored.runtime).toEqual(c.runtime);expect(restored.quickbarActions).toEqual(c.quickbarActions);expect(restored.sheetBonuses).toEqual(c.sheetBonuses);expect(restored.notes).toBe(c.notes);
  expect(evaluate(restored).resistances).toEqual(evaluate(c).resistances);
  setInfusionTarget(restored,choiceId,entry.id,null);expect(evaluate(restored).resistances).toEqual([]);
 }
 expect(JSON.stringify(c)).toBe(before);
});
