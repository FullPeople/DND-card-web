import {afterEach,describe,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {cloudSaveScheduler,snapshotHasher} from '../src/cloud/saveScheduler';

afterEach(()=>vi.useRealTimers());
describe('standalone cloud scheduling',()=>{
 it('checks only the selected card on cold start, even with a large book',async()=>{
  vi.useFakeTimers();const cards=Array.from({length:200},()=>newCharacter()),sync=vi.fn(async()=>{}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe(cards,cards[100].id);await vi.advanceTimersByTimeAsync(650);
  expect(sync.mock.calls).toEqual([[cards[100].id]]);queue.enable(false);
 });
 it('coalesces edits and does not schedule unchanged cards or reordering',async()=>{
  vi.useFakeTimers();let cards=Array.from({length:50},()=>newCharacter());const sync=vi.fn(async()=>{}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe(cards,cards[0].id);await vi.advanceTimersByTimeAsync(650);sync.mockClear();
  for(let i=0;i<10;i++){cards=[{...cards[0],runtime:{...cards[0].runtime,hp:i}},...cards.slice(1)];queue.observe(cards,cards[0].id);await vi.advanceTimersByTimeAsync(20);}
  await vi.advanceTimersByTimeAsync(650);expect(sync.mock.calls).toEqual([[cards[0].id]]);sync.mockClear();
  queue.observe([...cards].reverse(),cards[0].id);await vi.advanceTimersByTimeAsync(650);expect(sync).not.toHaveBeenCalled();queue.enable(false);
 });
 it('retains an edit when switching cards before the save delay',async()=>{
  vi.useFakeTimers();let a=newCharacter(),b=newCharacter();const sync=vi.fn(async()=>{}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe([a,b],a.id);await vi.advanceTimersByTimeAsync(650);sync.mockClear();
  a={...a,name:'快速切卡前的草稿'};queue.observe([a,b],a.id);queue.observe([a,b],b.id);await vi.advanceTimersByTimeAsync(650);
  expect(sync.mock.calls).toEqual([[a.id],[b.id]]);queue.enable(false);
 });
 it('pauses offline or read-only work and resumes once without losing edits',async()=>{
  vi.useFakeTimers();const card=newCharacter(),sync=vi.fn(async()=>{}),queue=cloudSaveScheduler(sync);
  queue.observe([card],card.id);queue.enable(true);await vi.advanceTimersByTimeAsync(100);queue.enable(false);await vi.advanceTimersByTimeAsync(10000);expect(sync).not.toHaveBeenCalled();
  queue.enable(true);await vi.advanceTimersByTimeAsync(650);expect(sync).toHaveBeenCalledTimes(1);queue.enable(false);
 });
 it('does not sync deleted queued cards',async()=>{
  vi.useFakeTimers();const card=newCharacter(),sync=vi.fn(async()=>{}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe([card],card.id);queue.observe([]);await vi.advanceTimersByTimeAsync(1000);expect(sync).not.toHaveBeenCalled();queue.enable(false);
 });
 it('serializes requests and retains newer edits while an earlier save waits',async()=>{
  vi.useFakeTimers();let release!:()=>void,card=newCharacter();const held=new Promise<void>(resolve=>release=resolve),sync=vi.fn(async()=>{if(sync.mock.calls.length===1)await held;}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe([card],card.id);await vi.advanceTimersByTimeAsync(650);expect(sync).toHaveBeenCalledTimes(1);
  card={...card,name:'保存期间的新草稿'};queue.observe([card],card.id);await vi.advanceTimersByTimeAsync(2000);expect(sync).toHaveBeenCalledTimes(1);
  release();await vi.advanceTimersByTimeAsync(650);expect(sync).toHaveBeenCalledTimes(2);queue.enable(false);
 });
 it('does not retry a failed save repeatedly without another edit',async()=>{
  vi.useFakeTimers();const card=newCharacter(),sync=vi.fn(async()=>{throw Error('uncertain write');}),queue=cloudSaveScheduler(sync);
  queue.enable(true);queue.observe([card],card.id);await vi.advanceTimersByTimeAsync(10000);expect(sync).toHaveBeenCalledTimes(1);queue.enable(false);
 });
 it('hashes one immutable snapshot once, but a new snapshot always gets a fresh hash',async()=>{
  const card=newCharacter(),hash=vi.fn(async c=>JSON.stringify(c.runtime)),memo=snapshotHasher(hash);
  await Promise.all(Array.from({length:20},()=>memo(card)));expect(hash).toHaveBeenCalledTimes(1);
  const next={...card,runtime:{...card.runtime,hp:5}};expect(await memo(next)).not.toBe(await memo(card));expect(hash).toHaveBeenCalledTimes(2);
 });
 it('does not retain a failed digest promise',async()=>{
  const card=newCharacter(),hash=vi.fn().mockRejectedValueOnce(Error('interrupted')).mockResolvedValue('good'),memo=snapshotHasher(hash);
  await expect(memo(card)).rejects.toThrow('interrupted');expect(await memo(card)).toBe('good');expect(hash).toHaveBeenCalledTimes(2);
 });
});
