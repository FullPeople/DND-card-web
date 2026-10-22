import {describe,it,expect,vi} from 'vitest';
import {catalogProgressStore} from '../src/ui/catalogProgress';
import type {LoadProgress} from '../src/data/catalog';

const initial:LoadProgress={done:0,total:3,label:'waiting',failed:[],cached:0};
describe('catalog progress snapshots',()=>{
 it('keeps failure, retry, pause and recovery transitions even when counts stay equal',()=>{
  const store=catalogProgressStore(initial),changed=vi.fn();store.subscribe(changed);
  store.publish({...initial,done:2,failed:['one unavailable'],retry:['source:one'],paused:'offline'});
  expect(store.getSnapshot()).toMatchObject({done:2,failed:['one unavailable'],retry:['source:one'],paused:'offline'});
  store.publish({...store.getSnapshot(),retry:['source:two']});
  expect(store.getSnapshot().retry).toEqual(['source:two']);
  store.publish({...store.getSnapshot(),paused:undefined,recovered:['source:one']});
  expect(store.getSnapshot()).toMatchObject({failed:['one unavailable'],retry:['source:two'],recovered:['source:one']});
  expect(store.getSnapshot().paused).toBeUndefined();
  store.publish({...initial,done:3,cached:2,label:'complete',retry:[],recovered:['source:one']});
  expect(store.getSnapshot()).toMatchObject({done:3,cached:2,failed:[],retry:[],recovered:['source:one']});
  expect(changed).toHaveBeenCalledTimes(4);
 });
 it('owns its snapshot and keeps equal updates stable without losing changed fields',()=>{
  const store=catalogProgressStore(initial),changed=vi.fn();store.subscribe(changed);
  const value={...initial,failed:['first'],retry:['first-key'],recovered:['old-key']};store.publish(value);
  const saved=store.getSnapshot();value.failed.push('later');value.retry.push('later-key');value.recovered.push('later-old');
  expect(saved.failed).toEqual(['first']);expect(saved.retry).toEqual(['first-key']);expect(saved.recovered).toEqual(['old-key']);
  store.publish({...saved,failed:[...saved.failed],retry:[...saved.retry!],recovered:[...saved.recovered!]});
  expect(store.getSnapshot()).toBe(saved);expect(changed).toHaveBeenCalledTimes(1);
  store.publish({...saved,label:'new stage'});store.publish({...store.getSnapshot(),cached:1});
  expect(changed).toHaveBeenCalledTimes(3);
 });
 it('isolates mounted instances and removes a departed subscriber',()=>{
  const first=catalogProgressStore(initial),second=catalogProgressStore(initial),changed=vi.fn(),stop=first.subscribe(changed);
  first.publish({...initial,done:1});expect(second.getSnapshot()).toEqual(initial);expect(changed).toHaveBeenCalledTimes(1);
  stop();first.publish({...initial,done:2});expect(changed).toHaveBeenCalledTimes(1);expect(second.getSnapshot().done).toBe(0);
 });
});
