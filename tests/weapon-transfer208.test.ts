import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportOwlbear} from '../src/core/export';
import {normalizeLegacyUpload} from '../src/platform/legacyPlayerBridge';
import {readCharacterTransfer} from '../src/core/transfers';
import {weaponAttacks} from '../src/core/weaponAttacks';

describe('weapon attacks survive website / Owlbear transfer',()=>{
 it('preserves manual attack and damage through the exact legacy upload adapter and native roundtrip',()=>{
  const c=newCharacter();c.quickbarActions=[{id:'longbow',name:'测试长弓',attack:'+7',damage:'1d8+4'},{id:'dagger',name:'测试匕首',attack:'+5',damage:'1d4+3'}];
  const doc=normalizeLegacyUpload(exportCharacter(c));
  expect(doc.combat.weapons.map(w=>[w.name,w.attack_bonus,w.damage])).toEqual([['测试长弓','+7','1d8+4'],['测试匕首','+5','1d4+3']]);
  const [restored]=readCharacterTransfer([JSON.stringify(doc)]);
  expect(restored.quickbarActions).toEqual(c.quickbarActions);
  expect(normalizeLegacyUpload(doc).combat.weapons).toEqual(doc.combat.weapons);
 });
 it('retains structured equipment damage without inventing a proficiency bonus or requiring another equipment toggle',()=>{
  const c=newCharacter('2014'),[entry]=normalizeData({item:[{name:'测试武器',source:'PHB',type:'M',dmg1:'1d6',dmgType:'P'}]},'test');
  c.selections=[{id:'weapon',entry,level:1,quantity:1,equipped:true}];
  const attack=exportOwlbear(c,evaluate(c)).combat.weapons[0];expect(attack.name).toBe('测试武器');expect(attack.damage).toBe('1d6');expect(attack.attack_bonus).toBeUndefined();
  expect(weaponAttacks(c)).toHaveLength(1);
 });
 it('does not erase legacy attacks and keeps the sheet order and hidden choices in the projection',()=>{
  const c=newCharacter();c.externalSnapshot={combat:{weapons:[{name:'旧卡武器',attack_bonus:'+8',damage:'2d6+5',extra_damage:'1d4',damage_type:'挥砍'}]}};
  c.quickbarActions=[{id:'unarmed',name:'徒手',attack:'+2',damage:'1'}];
  c.quickbarLayout={order:['weapon:0:旧卡武器','custom:unarmed'],hidden:['custom:unarmed']};
  const doc=normalizeLegacyUpload(exportCharacter(c));expect(doc.combat.weapons).toHaveLength(1);expect(doc.combat.weapons[0]).toMatchObject({name:'旧卡武器',damage:'2d6+5',extra_damage:'1d4'});
  expect(doc.dnd_card_web.quickbarActions).toEqual(c.quickbarActions);
 });
});
