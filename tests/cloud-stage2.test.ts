import {afterEach,describe,expect,it,vi} from 'vitest';
import {previewCache,adjacentPreviews} from '../src/cloud/previewCache';
import {newCharacter} from '../src/core/model';
import {isolateCloudSource} from '../tools/cloudStageTwoProfile';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
const directory=(id='a')=>new Response(JSON.stringify({accountId:id,cards:[],slots:{total:10,used:0}}));
describe('private cloud workload and isolation',()=>{
 it('coalesces concurrent directory reads, then revalidates the next read',async()=>{
  let resolve!:(response:Response)=>void;
  const fetcher=vi.fn().mockReturnValueOnce(new Promise<Response>(yes=>resolve=yes)).mockResolvedValue(directory());vi.stubGlobal('fetch',fetcher);
  const {cloudDirectory:cloudCards}=await import('../src/cloud/directoryReader'),one=cloudCards(0,'a'),two=cloudCards(0,'a');
  expect(fetcher).toHaveBeenCalledTimes(1);resolve(directory());expect(await one).toEqual(await two);
  await cloudCards(0,'a');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('rejects an in-flight directory after a session notification',async()=>{
  let resolve!:(response:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(yes=>resolve=yes)));
  const api=await import('../src/cloud/api'),{cloudDirectory}=await import('../src/cloud/directoryReader'),old=cloudDirectory(0,'a');api.announceCloudSessionChange();resolve(directory());
  await expect(old).rejects.toMatchObject({code:'account_changed'});
 });
 it('never reuses private card previews across mounted account galleries',async()=>{
  const row={id:'ABCDEF',revision:1,name:'test',edition:'2024',updatedAt:''},character=newCharacter();
  const read=vi.fn(async()=>({...row,character})),first=previewCache(read),second=previewCache(read);
  await Promise.all([first.load(row),first.load(row)]);expect(read).toHaveBeenCalledTimes(1);
  expect(second.cache.size).toBe(0);await second.load(row);expect(read).toHaveBeenCalledTimes(2);
 });
 it('limits speculative reads to the nearest two cards, including short libraries',()=>{
  const cards=Array.from({length:40},(_,i)=>({id:String(i),revision:1,name:'',edition:'2024',updatedAt:''}));
  expect(adjacentPreviews(cards,0).map(row=>row.id)).toEqual(['39','1']);
  expect(adjacentPreviews(cards.slice(0,2),0).map(row=>row.id)).toEqual(['1']);
  expect(adjacentPreviews(cards.slice(0,1),0)).toEqual([]);
 });
 it('isolates API, landing paths, browser databases, preferences, channels and locks without altering startup signals',()=>{
  const source="fetch('/api/session');const paths=['/card/','/library/'];openDB('dnd-card-standalone');new BroadcastChannel('dnd-card-cloud');lock('dnd-card-editor');storage('dnd-card:editing');const event='dnd-card-startup';";
  const transformed=isolateCloudSource(source);
  for(const value of ['/cloud-lab/api/session','/cloud-lab/card/','/cloud-lab/library/','cloud-lab2:dnd-card-standalone','cloud-lab2:dnd-card-cloud','cloud-lab2:dnd-card-editor','cloud-lab2:dnd-card:editing'])expect(transformed).toContain(value);
  expect(transformed).toContain("event='dnd-card-startup'");
 });
});
