import {beforeEach,describe,expect,it,vi} from 'vitest';
import {newCharacter,type RulePack} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {createCharacterRowReader,localCharacterRow} from '../src/ui/characterRows';
import {withSiteSources} from '../src/core/siteSources';

vi.mock('../src/core/engine',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/core/engine')>();
 return {...actual,evaluate:vi.fn(actual.evaluate)};
});

describe('character book derived summaries',()=>{
 beforeEach(()=>{vi.mocked(evaluate).mockClear();});
 it('reopening or reordering an unchanged book does not reevaluate every card',()=>{
  const cards=Array.from({length:30},()=>newCharacter()),read=createCharacterRowReader();
  const rows=cards.map(card=>read(card));
  cards.slice().reverse().forEach((card,index)=>expect(read(card)).toBe(rows[29-index]));
  expect(evaluate).toHaveBeenCalledTimes(30);
 });
 it('an immutable local or cloud edit refreshes only its changed document',()=>{
  const a=newCharacter(),b=newCharacter(),read=createCharacterRowReader();
  const old=read(a),other=read(b),edited=structuredClone(a);
  edited.name='Updated';edited.runtime.hp=3;edited.locked=true;
  const next=read(edited);expect(next).toMatchObject({name:'Updated',hp:3,locked:true});
  expect(next).not.toBe(old);expect(read(b)).toBe(other);expect(evaluate).toHaveBeenCalledTimes(3);
 });
 it('a shared source change recomputes using the current source policy',()=>{
  const card=newCharacter(),read=createCharacterRowReader(),sources={enabledSources:['PHB']};
  const previous=read(card,sources),changed={enabledSources:['XPHB']};
  const next=read(card,changed);expect(next).not.toBe(previous);
  expect(next).toEqual(localCharacterRow(withSiteSources(card,changed)));
  expect(card.profile.enabledSources).not.toEqual(changed.enabledSources);
 });
 it('replacing the rule packs invalidates a summary even if the card is unchanged',()=>{
  const card=newCharacter(),sources={enabledSources:[]},packs:RulePack[]=[],read=createCharacterRowReader();
  const before=read(card,sources,packs);expect(read(card,sources,packs)).toBe(before);
  expect(read(card,sources,[...packs])).not.toBe(before);expect(evaluate).toHaveBeenCalledTimes(2);
 });
 it('permission changes are applied to each fresh visible row',()=>{
  const card=newCharacter(),read=createCharacterRowReader(),summary=read(card);
  const permitted={...read(card),write:true,cloudReadOnly:false};
  const revoked={...read(card),write:false,cloudReadOnly:true};
  expect(permitted.write).toBe(true);expect(revoked).toMatchObject({write:false,cloudReadOnly:true});
  expect(read(card)).toBe(summary);expect(evaluate).toHaveBeenCalledTimes(1);
 });
});
