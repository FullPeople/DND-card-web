import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cloudChangeNotice} from '../src/cloud/api';
import {subscribeAccountChanges} from '../src/cloud/accountChanges';
// Preserve enabled-state lifecycle coverage separately from suspension checks.
vi.mock('../src/cloud/availability',()=>({cloudFeaturesEnabled:true}));
vi.mock('../src/cloud/api',()=>({announceCloudSessionChange:vi.fn(),subscribeCloudSessionChanges:vi.fn(()=>()=>{}),cloudChangeNotice:vi.fn()}));
const stops:(()=>void)[]=[],replies:((value:Awaited<ReturnType<typeof cloudChangeNotice>>)=>void)[]=[];
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));vi.stubGlobal('navigator',{onLine:true});replies.length=0;
 vi.mocked(cloudChangeNotice).mockImplementation((_cursor,signal)=>new Promise((resolve,reject)=>{replies.push(resolve);signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});}));
});
afterEach(async()=>{for(const stop of stops.splice(0))stop();await vi.advanceTimersByTimeAsync(1);vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('account notifications share only the current page account',()=>{
 it('uses one held request for two consumers and refreshes both',async()=>{
  const book=vi.fn().mockResolvedValue(undefined),picker=vi.fn().mockResolvedValue(undefined);stops.push(subscribeAccountChanges('a',book),subscribeAccountChanges('a',picker));
  expect(cloudChangeNotice).toHaveBeenCalledTimes(1);replies[0]({accountId:'a',cursor:'a'.repeat(64),changed:true});await vi.advanceTimersByTimeAsync(1);
  expect(book).toHaveBeenCalledTimes(1);expect(picker).toHaveBeenCalledTimes(1);
 });
 it('does not call a consumer removed while the response was held',async()=>{
  const removed=vi.fn().mockResolvedValue(undefined),live=vi.fn().mockResolvedValue(undefined),stop=subscribeAccountChanges('a',removed);stops.push(subscribeAccountChanges('a',live));stop();
  replies[0]({accountId:'a',cursor:'a'.repeat(64),changed:true});await vi.advanceTimersByTimeAsync(1);expect(removed).not.toHaveBeenCalled();expect(live).toHaveBeenCalledTimes(1);
 });
 it('keeps separate account scopes and rejects a stale account tag',async()=>{
  const first=vi.fn().mockResolvedValue(undefined),second=vi.fn().mockResolvedValue(undefined);stops.push(subscribeAccountChanges('a',first),subscribeAccountChanges('b',second));
  replies[0]({accountId:'b',cursor:'a'.repeat(64),changed:true});replies[1]({accountId:'b',cursor:'b'.repeat(64),changed:true});await vi.advanceTimersByTimeAsync(1);expect(first).not.toHaveBeenCalled();expect(second).toHaveBeenCalledTimes(1);
 });
 it('does not start transport while hidden and wakes when visible',async()=>{
  const changed=vi.fn().mockResolvedValue(undefined);Object.assign(document,{visibilityState:'hidden'});stops.push(subscribeAccountChanges('a',changed));expect(cloudChangeNotice).not.toHaveBeenCalled();
  Object.assign(document,{visibilityState:'visible'});document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(1);expect(cloudChangeNotice).toHaveBeenCalledTimes(1);
 });
});
