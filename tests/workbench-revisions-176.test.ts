import {describe,it,expect} from 'vitest';
import {WorkbenchRevisions,currentInventory} from '../src/core/workbenchRevisions';
const snap=(revision:number,current:number,conditions:string[]=[])=>({sequence:revision,state:{key:'room:card:a',cardId:'a',write:true,stats:{health:current},resources:[{id:'slot',current}],conditions:conditions.map(name=>({name})),documentRevision:revision},document:{_suiteRevision:revision,dnd_card_web:{current}}});
describe('durable workbench revisions',()=>{
 it('rejects old runtime and document even with a newer host sequence or restart',()=>{
  const gate=new WorkbenchRevisions();gate.snapshot(snap(8,0));
  const old=gate.snapshot({...snap(7,2,['束缚']),sequence:99});
  expect(old.document._suiteRevision).toBe(8);expect(old.state.resources[0].current).toBe(0);expect(old.state.conditions).toEqual([]);
  expect(gate.snapshot({...snap(6,2),sequence:1}).state.stats.health).toBe(0);
  expect(gate.snapshot({...snap(9,1),sequence:2}).state.stats.health).toBe(1);
 });
 it('applies latest access flags without reviving removed conditions',()=>{
  const gate=new WorkbenchRevisions();gate.snapshot(snap(4,0));
  const old=snap(3,2,['束缚']);old.state.write=false;
  const accepted=gate.snapshot(old);expect(accepted.state.write).toBe(false);expect(accepted.state.conditions).toEqual([]);
 });
 it('an acknowledged card revision also protects later overview catalogs',()=>{
  const gate=new WorkbenchRevisions();gate.snapshot(snap(4,0));
  const card=gate.card({id:'a',documentRevision:3,write:false,locked:true,inScene:false,resources:[{id:'slot',current:2}]});
  expect(card.resources[0].current).toBe(0);expect(card.locked).toBe(true);expect(card.write).toBe(false);expect(card.inScene).toBe(false);
 });
 it('does not use a different card or legacy snapshot to downgrade known document',()=>{
  const gate=new WorkbenchRevisions();gate.snapshot(snap(5,0));
  expect(gate.card({id:'b',resources:[{id:'slot',current:2}]}).resources[0].current).toBe(2);
  const old=snap(0,2);delete (old.document as any)._suiteRevision;delete (old.state as any).documentRevision;
  expect(gate.snapshot(old).state.stats.health).toBe(0);
 });
 it('rejects stale stock for one scope but never reintroduces revoked containers',()=>{
  const current={publicId:'room',access:'owner',revision:10,containers:{a:{}}};
  expect(currentInventory(current,{...current,revision:8})).toBe(current);
  const revoked={publicId:'room',access:'viewer',revision:8,containers:{}};
  expect(currentInventory(current,revoked)).toBe(revoked);
  const scene={...revoked,publicId:'scene'};expect(currentInventory(current,scene)).toBe(scene);
 });
});
