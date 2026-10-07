import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {equipSelection} from '../src/core/automation/equipment';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {normalizeData} from '../src/data/catalog';
import {equipmentAcCard} from './helpers/equipmentAcFixture';
import {loadLockedEquipment,parseLockedEquipment,sourceLock} from './helpers/equipmentAcSource';
import mechanisms from './fixtures/equipment-ac-mechanisms.json' with {type:'json'};

function authoredInput(){
 const bytes=Buffer.from(JSON.stringify({baseitem:sourceLock.entries.map(e=>({name:'原创结构夹具 '+e.english,ENG_name:e.english,source:e.source,edition:e.edition==='2014'?'classic':'one',type:e.type,ac:e.ac,page:e.page}))}));
 return {bytes,lock:{...sourceLock,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
}
describe('authored source-gate counterexamples, not real corpus evidence',()=>{
 it('rejects byte drift and hash drift before parsing',()=>{
  const {bytes,lock}=authoredInput();expect(parseLockedEquipment(bytes,lock)).toHaveLength(6);
  expect(()=>parseLockedEquipment(Buffer.concat([bytes,Buffer.from(' ')]),lock)).toThrow(/byte\/hash/);
  const changed=Buffer.from(bytes);changed[10]^=1;expect(()=>parseLockedEquipment(changed,lock)).toThrow(/byte\/hash/);
 });
 it('rejects duplicated stable identities even when the supplied authored input hash matches',()=>{
  const {bytes,lock}=authoredInput(),body=JSON.parse(bytes.toString());body.baseitem.push(body.baseitem[0]);const changed=Buffer.from(JSON.stringify(body));
  expect(()=>parseLockedEquipment(changed,{...lock,bytes:changed.length,sha256:createHash('sha256').update(changed).digest('hex')})).toThrow(/duplicated/);
 });
 it.each([['ac',17],['type','MA'],['edition','one']])('rejects changed %s rather than silently rewriting the lock',(field,value)=>{
  const {bytes,lock}=authoredInput(),body=JSON.parse(bytes.toString());body.baseitem[0][field]=value;const changed=Buffer.from(JSON.stringify(body));
  expect(()=>parseLockedEquipment(changed,{...lock,bytes:changed.length,sha256:createHash('sha256').update(changed).digest('hex')})).toThrow(/structured fields/);
 });
});
const path=process.env.DND_EQUIPMENT_AC_SOURCE;
describe.skipIf(!path)('six byte-locked real items with separately reviewed public AC mechanisms',()=>{
 for(const edition of ['2014','2024'] as const){
  it(`${edition} retains exactly three stable identities and strips upstream prose`,()=>{
   const entries=loadLockedEquipment(path!).filter(e=>e.edition===edition);
   expect(entries.map(e=>[e.id,e.raw.type,e.raw.ac])).toEqual(sourceLock.entries.filter(e=>e.edition===edition).map(e=>[e.id,e.type,e.ac]));
   const normalized=normalizeData({baseitem:entries.map(e=>e.raw)},'sha256:'+sourceLock.sha256);
   expect(normalized.map(e=>[e.id,e.edition,e.raw.type,e.raw.ac])).toEqual(entries.map(e=>[e.id,e.edition,e.raw.type,e.raw.ac]));
   expect(entries.every(e=>!e.raw.entries&&e.revision==='sha256:'+sourceLock.sha256)).toBe(true);
  });
  it(`${edition} matches the official AC matrix on three locked identities with explicit recorded training`,()=>{
   const entries=loadLockedEquipment(path!);
   for(const row of mechanisms.armorCases){
    const c=equipmentAcCard(edition,entries);c.abilities.dex=row.dexScore;
    expect(evaluate(c).ac,row.id).toBe(row.unarmored);equipSelection(c,'heavy',true);expect(evaluate(c).ac,row.id).toBe(row.chain);equipSelection(c,'shield',true);expect(evaluate(c).ac,row.id).toBe(row.chainWithTrainedShield);
    equipSelection(c,'medium',true);expect(evaluate(c).ac,row.id).toBe(row.scaleWithTrainedShield);equipSelection(c,'shield',false);expect(evaluate(c).ac,row.id).toBe(row.scale);equipSelection(c,'medium',false);expect(evaluate(c).ac,row.id).toBe(row.unarmored);
   }
   for(const row of mechanisms.shieldCases.filter(row=>row.edition===edition)){
    const c=equipmentAcCard(edition,entries);c.training!.armor=row.shieldTraining?'中甲、重甲、盾牌':'中甲、重甲';equipSelection(c,'heavy',true);equipSelection(c,'shield',true);
    const before=JSON.stringify(c),result=evaluate(c);expect(result.ac,row.id).toBe(row.chainWithShield);expect(JSON.stringify(c)).toBe(before);
    const warning=result.issues.find(i=>i.id==='armor-training:shield');expect(!!warning).toBe(!row.shieldTraining);
    if(edition==='2024'&&!row.shieldTraining)expect(warning!.message).not.toMatch(/劣势|施法/);
   }
  });
  it(`${edition} never stacks quantities and preserves source restrictions and manual resources through backup`,()=>{
   const c=equipmentAcCard(edition,loadLockedEquipment(path!));c.abilities.dex=10;equipSelection(c,'heavy',true);equipSelection(c,'shield',true);
   const shield=c.selections.find(s=>s.id==='shield')!;shield.quantity=9;expect(evaluate(c).ac).toBe(18);
   c.selections.push({...structuredClone(shield),id:'duplicate-shield'});const conflicted=JSON.stringify(c),result=evaluate(c);expect(result.ac).toBe(16);expect(result.ac).not.toBe(20);expect(result.issues.some(i=>i.id==='equipment-conflict:shield')).toBe(true);expect(JSON.stringify(c)).toBe(conflicted);
   equipSelection(c,'shield',true);expect(evaluate(c).ac).toBe(18);c.profile.enabledSources=[];const before=JSON.stringify(c);expect(evaluate(c).ac).toBe(10);expect(JSON.stringify(c)).toBe(before);
   const loaded=readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;expect(evaluate(loaded).ac).toBe(10);expect(loaded.selections).toEqual(c.selections);expect(loaded.runtime).toEqual(c.runtime);expect(loaded.answers).toEqual(c.answers);expect(loaded.profile.enabledSources).toEqual([]);
  });
 }
});
