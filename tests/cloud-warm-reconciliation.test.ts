import {describe,expect,it,vi} from 'vitest';
import {settledSnapshotCheck} from '../src/platform/settledSnapshotCheck';
import {readViewMemo} from '../src/ui/useReadViewMemo';
import {syncTiming} from '../src/cloud/syncTiming';
import {newCharacter,type Entry} from '../src/core/model';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {newAutomationState} from '../src/core/automation/state';

describe('isolated cloud warm views',()=>{
 it('skips settled snapshots, but not changed, failed or new snapshots',()=>{
  const check=settledSnapshotCheck(true),a={},b={},unchanged=vi.fn(()=>false),changed=vi.fn(()=>true);
  check(a,unchanged);check(b,unchanged);for(let n=0;n<30;n++){check(a,unchanged);check(b,unchanged);}expect(unchanged).toHaveBeenCalledTimes(2);
  const next={};check(next,changed);check(next,changed);expect(changed).toHaveBeenCalledTimes(2);
  const broken={};expect(()=>check(broken,()=>{throw Error('retry');})).toThrow('retry');expect(check(broken,changed)).toBe(true);
  check({},unchanged);expect(unchanged).toHaveBeenCalledTimes(3);
  settledSnapshotCheck(true)(a,unchanged);expect(unchanged).toHaveBeenCalledTimes(4);
 });
 it('preserves every check in the normal and embedded profiles',()=>{
  const check=settledSnapshotCheck(false),card={},run=vi.fn(()=>false);check(card,run);check(card,run);expect(run).toHaveBeenCalledTimes(2);
 });
 it('bounds retained projections and invalidates every dependency independently',()=>{
  const memo=readViewMemo(2),a={},b={},catalog={},run=vi.fn(()=>[]);
  const first=memo([a,catalog,'spell','name',false],run);memo([b,catalog,'spell','name',false],run);
  for(let n=0;n<20;n++)expect(memo([a,catalog,'spell','name',false],run)).toBe(first);expect(run).toHaveBeenCalledTimes(2);
  for(const deps of [[a,{},'spell','name',false],[a,catalog,'class','name',false],[a,catalog,'spell','source',false],[a,catalog,'spell','name',true]])memo(deps,run);
  expect(run).toHaveBeenCalledTimes(6);expect(memo([a,catalog,'spell','name',false],run)).not.toBe(first);expect(run).toHaveBeenCalledTimes(7);
 });
 it('does not cache a failed projection',()=>{
  const memo=readViewMemo(),key={};expect(()=>memo([key],()=>{throw Error('source');})).toThrow('source');expect(memo([key],()=>42)).toBe(42);
 });
 it('keeps reference results inside the exact source, selection and edition context',()=>{
  const contexts=readViewMemo(),sourceA={},sourceB={},selectionA={},selectionB={},lookup=vi.fn((reference:string,kind:string)=>({reference,kind}));
  const cache=(sources:object,selections:object,edition:string)=>contexts([sources,selections,edition],()=>readViewMemo(2));
  const a=cache(sourceA,selectionA,'2014'),first=a(['same','spell'],()=>lookup('same','spell'));
  expect(cache(sourceA,selectionA,'2014')(['same','spell'],()=>lookup('same','spell'))).toBe(first);expect(lookup).toHaveBeenCalledTimes(1);
  expect(a(['same','item'],()=>lookup('same','item'))).not.toBe(first);
  for(const changed of [cache(sourceB,selectionA,'2014'),cache(sourceA,selectionB,'2014'),cache(sourceA,selectionA,'2024')])expect(changed(['same','spell'],()=>lookup('same','spell'))).not.toBe(first);
  const missing=cache({},selectionA,'2014');expect(missing(['later','spell'],()=>undefined)).toBeUndefined();
  expect(cache({},selectionA,'2014')(['later','spell'],()=>lookup('later','spell'))).toEqual({reference:'later',kind:'spell'});
 });
 it('reuses unchanged real reconciliation functions without mutating stored cards',()=>{
  const entries:Entry[]=Array.from({length:70},(_,n)=>({id:`warm:${n}`,kind:'feature',name:`Authored ${n}`,english:`Authored ${n}`,edition:'2024',source:'XPHB',packId:'fixture',revision:'1',raw:{},entries:['Authored rule content.']}));
  const cards=[newCharacter(),newCharacter()];for(const card of cards){card.automation=newAutomationState();card.selections=entries.map(entry=>({id:entry.id,entry,level:1,quantity:1,equipped:false}));}
  const originals=JSON.stringify(cards),check=settledSnapshotCheck(true);let runs=0;
  const inspect=(card:typeof cards[number])=>check(card,()=>{runs++;const draft=structuredClone(card);return syncFeatures(draft,entries)||syncAutoResources(draft)||syncSourceSpells(draft,entries);});
  cards.forEach(inspect);const initialRuns=runs;for(let n=0;n<20;n++)inspect(cards[n%2]);expect(runs).toBe(initialRuns);expect(JSON.stringify(cards)).toBe(originals);
  inspect({...cards[0],name:'Changed snapshot'});expect(runs).toBe(initialRuns+1);
 });
});

it('times only completed sync transactions and never labels a failure as a successful save',()=>{
 let now=0;const probe=syncTiming(()=>now);probe.observe('a','saved');expect(probe.read('a')).toBeUndefined();
 now=100;probe.observe('a','syncing');now=120;probe.observe('a','syncing');now=165;probe.observe('a','saved');expect(probe.read('a')).toBe(65);
 now=180;probe.observe('b','syncing');now=200;probe.observe('a','syncing');now=240;probe.observe('b','saved');expect(probe.read('b')).toBe(60);
 probe.observe('a','conflict');expect(probe.read('a')).toBeUndefined();probe.observe('a','saved');expect(probe.read('a')).toBeUndefined();
 probe.observe('b','error');expect(probe.read('b')).toBeUndefined();
});
