import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {WorkbenchRevisions} from '../src/core/workbenchRevisions';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
const wire=vi.hoisted(()=>({sent:[] as any[],receive:undefined as undefined|((m:any)=>void)}));
vi.mock('../src/platform/relay',()=>({Relay:class{
 constructor(_url:string,_session:string,_role:string,_secret:string,receive:(m:any)=>void){wire.receive=receive;}
 send(message:any){wire.sent.push(message);return Promise.resolve();}
}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();wire.sent=[];vi.stubGlobal('window',Object.assign(new EventTarget(),{opener:null}));vi.stubGlobal('location',new URL('https://fixture.test/#suite=lifetime&bridge=https%3A%2F%2Ffixture.test&relay=fixture'));});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const card=(id='a')=>({id,name:id,itemId:'token-'+id,write:true,locked:false,inScene:true,resources:[],stats:{health:10},documentRevision:5});
const access=(epoch=1,ids=['a','b'],scope='room:scene-1')=>({room:'room',scope,epoch,role:'PLAYER',cards:ids.map(id=>card(id)),monsters:[],enabled:{characterCards:true}});
const snapshot=(id='a',sequence=2,revision=5,name='Current')=>{const c=newCharacter();c.id='suite:room:card:'+id;c.name=name;return {sequence,state:{...card(id),key:'room:card:'+id,cardId:id,kind:'character',role:'PLAYER',pinned:false,documentRevision:revision},document:{dnd_card_web:c,_suiteRevision:revision,portrait:'large-body-marker'}};};
const receive=(type:string,extra:any={})=>wire.receive!({protocol:'full-suite-workbench/v1',session:'lifetime',hostStarted:1,type,...extra});
async function ready(){const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,access:access(),cards:[card(),card('b')],monsters:[],role:'PLAYER',enabled:{characterCards:true}});receive('selection',{...snapshot(),access:access()});return api;}
function queueEdit(api:Awaited<ReturnType<typeof ready>>){const before=api.getWorkbench().document.dnd_card_web,after=structuredClone(before);after.name='Local draft';return {before,after,result:api.patchWorkbenchStats(before,after,evaluate(before),evaluate(after))!};}
const saves=()=>wire.sent.filter(m=>m.type==='save');

describe('released workbench document revisions',()=>{
 it('releases only unreadable full bodies and preserves a revision floor',()=>{
  const revisions=new WorkbenchRevisions(),a=snapshot(),b=snapshot('b');revisions.snapshot(a);revisions.snapshot(b);
  revisions.releaseUnreadable(target=>target.cardId==='b');
  expect((revisions as any).documents.size).toBe(1);expect((revisions as any).documents.has(a.state.key)).toBe(false);
  expect((revisions as any).released.get(a.state.key)).toBe(5);
  expect(revisions.snapshot(snapshot('a',50,4,'Old'))).toBeUndefined();
  expect(revisions.snapshot({...b,sequence:40,document:structuredClone(b.document)}).document).toBe(b.document);
 });
 it('accepts a regranted same/newer body, while existing bodies still normalize stale input',()=>{
  const revisions=new WorkbenchRevisions();revisions.snapshot(snapshot());revisions.releaseUnreadable(()=>false);
  const same=snapshot('a',10,5,'Same revision');expect(revisions.snapshot(same).document).toBe(same.document);
  const latest=snapshot('a',12,6,'Latest');revisions.snapshot(latest);
  expect(revisions.snapshot(snapshot('a',15,4,'Old')).document).toBe(latest.document);
  expect((revisions as any).released.size).toBe(0);
 });
 it('does not retain full document raw/portrait objects in released revision watermarks',()=>{
  const revisions=new WorkbenchRevisions(),message=snapshot(),body={portrait:'independent-large-portrait'.repeat(10000),rawHeavy:{content:'independent-document-body'.repeat(10000)}};
  Object.assign(message.document,body);revisions.snapshot(message);revisions.releaseUnreadable(()=>false);
  expect((revisions as any).documents.size).toBe(0);expect([...((revisions as any).released as Map<string,number>).values()]).toEqual([5]);
  const summaries=JSON.stringify([...((revisions as any).cards as Map<string,unknown>).values()]);
  expect(summaries).not.toContain('independent-large-portrait');expect(summaries).not.toContain('independent-document-body');
 });
});

describe('authorization retirement and asynchronous workbench results',()=>{
 it('preserves readable bodies when only editing permission is revoked',async()=>{
  const api=await ready(),before=api.getWorkbench().document,readonly=access(2);readonly.cards[0].write=false;receive('access',{access:readonly});
  expect(api.getWorkbench().document).toBe(before);expect(api.getWorkbench().target?.write).toBe(false);
  api.chooseWorkbench('card:b');api.chooseWorkbench('card:a');expect(api.getWorkbench().document).toBe(before);expect(api.getWorkbench().target?.write).toBe(false);
 });
 it('rejects stale body after same-scope read revoke/regrant, but accepts a current body',async()=>{
  const api=await ready();receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});
  api.chooseWorkbench('card:a');receive('cacheSnapshot',{...snapshot('a',10,4,'Stale'),access:access(3)});
  expect(api.getWorkbench().document).toBeUndefined();expect(api.getWorkbench().loading).toBe(true);
  receive('cacheSnapshot',{...snapshot('a',11,5,'Current again'),access:access(3)});
  expect(api.getWorkbench().document.dnd_card_web.name).toBe('Current again');
 });
 it('does not cancel another still-readable card debounce or discard its cloned delta baseline',async()=>{
  const api=await ready(),edit=queueEdit(api);receive('access',{access:access(2,['a'])});
  await vi.advanceTimersByTimeAsync(100);expect(saves()).toHaveLength(1);
  expect(saves()[0].delta.native).toContainEqual(expect.objectContaining({path:['name'],before:'Current',after:'Local draft',observed:'Current'}));
  receive('ack',{requestId:saves()[0].requestId,ok:true,result:{snapshot:{...snapshot('a',15,6,'Local draft'),access:access(2,['a'])}}});await edit.result;
  expect(api.getWorkbench().document.dnd_card_web.name).toBe('Local draft');expect(edit.after.name).toBe('Local draft');
 });
 it('cancels revoked 80ms intent even after regrant, preserving the caller draft',async()=>{
  const api=await ready(),edit=queueEdit(api),result=edit.result.catch(error=>error);
  receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});await vi.advanceTimersByTimeAsync(100);
  expect(saves()).toHaveLength(0);expect(await result).toMatchObject({permissionChanged:true});expect(edit.after.name).toBe('Local draft');
 });
 it('settles an in-flight revoked ACK without reviving old body or replaying its queued successor',async()=>{
  const api=await ready(),first=queueEdit(api),result=first.result.catch(error=>error);await vi.advanceTimersByTimeAsync(100);const request=saves()[0];
  const next=queueEdit(api),queued=next.result.catch(error=>error);await vi.advanceTimersByTimeAsync(100);
  receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});
  receive('ack',{requestId:request.requestId,ok:true,result:{snapshot:{...snapshot('a',20,6,'Late commit'),access:access()}}});await vi.advanceTimersByTimeAsync(100);
  expect(await result).toMatchObject({permissionChanged:true,uncertain:true});expect(await queued).toBeInstanceOf(Error);
  expect(saves()).toHaveLength(1);expect(api.getWorkbench().document).toBeUndefined();expect(first.after.name).toBe('Local draft');
 });
 it('late read after revocation cannot restore body or authority, and rapid A/B keeps B',async()=>{
  const api=await ready();api.chooseWorkbench('card:b');receive('access',{access:access(2,['a'])});
  receive('selection',{...snapshot('b',9,5,'Late B'),access:access()});expect(api.getWorkbench().target?.cardId).not.toBe('b');
  receive('access',{access:access(3)});api.chooseWorkbench('card:a');api.chooseWorkbench('card:b');
  receive('cacheSnapshot',{...snapshot('b',20,5,'B now'),access:access(3)});expect(api.getWorkbench().target?.cardId).toBe('b');
  receive('selection',{...snapshot('a',21,5,'Late A'),access:access(3),clientSelection:2});expect(api.getWorkbench().target?.cardId).toBe('b');
 });
 it('new scope resets old floors without allowing old-scope bodies back',async()=>{
  const api=await ready();receive('access',{access:access(2,['b'])});const next=access(3,['a'],'room:scene-2');next.cards[0].documentRevision=1;receive('access',{access:next});api.chooseWorkbench('card:a');
  receive('cacheSnapshot',{...snapshot('a',20,99,'Old scope'),access:access()});expect(api.getWorkbench().document).toBeUndefined();
  receive('cacheSnapshot',{...snapshot('a',21,1,'New scope'),access:next});expect(api.getWorkbench().document.dnd_card_web.name).toBe('New scope');
 });
});

it('settles ACK bookkeeping even when its current-access body is below a retired floor',async()=>{
 const api=await ready();receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});api.chooseWorkbench('card:a');
 const pending=api.workbenchRequest('readCard',{key:undefined,itemId:'card:a'}),request=wire.sent.at(-1);
 receive('ack',{requestId:request.requestId,ok:true,result:{marker:'receipt-kept',snapshot:{...snapshot('a',15,4,'Outdated'),access:access(3)}}});
 expect(await pending).toMatchObject({marker:'receipt-kept',snapshot:undefined});expect(api.workbenchDiagnostics().pending).toHaveLength(0);expect(api.getWorkbench().document).toBeUndefined();
});

it('skips a retired stale batch snapshot without losing a current different-card result',async()=>{
 const api=await ready();receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});api.chooseWorkbench('card:b');
 receive('cacheSnapshot',{...snapshot('b',10,5,'B current'),access:access(3)});
 const pending=api.workbenchRequest('readCard',{key:undefined,itemId:'card:b'}),request=wire.sent.at(-1);
 receive('ack',{requestId:request.requestId,ok:true,result:{snapshots:[{...snapshot('a',15,4,'Outdated A'),access:access(3)},{...snapshot('b',16,6,'B updated'),access:access(3)}]}});
 await pending;expect(api.getWorkbench().target?.cardId).toBe('b');expect(api.getWorkbench().document.dnd_card_web.name).toBe('B updated');expect(api.workbenchDiagnostics().pending).toHaveLength(0);
});

it('ends an explicit stale-body retry visibly and allows a later current-body retry',async()=>{
 const api=await ready();receive('access',{access:access(2,['b'])});receive('access',{access:access(3)});api.chooseWorkbench('card:a');
 receive('selectionError',{targetId:'card:a',status:404,sequence:10,access:access(3),message:'Missing'});
 const retry=api.retryWorkbenchRead();const request=wire.sent.filter(m=>m.type==='refreshCard').at(-1);
 receive('ack',{requestId:request.requestId,ok:true,result:{snapshot:{...snapshot('a',11,4,'Outdated'),access:access(3)}}});await retry;
 expect(api.getWorkbench().document).toBeUndefined();expect(api.getWorkbench().loading).toBe(false);expect(api.getWorkbench().readFailure?.targetId).toBe('card:a');
 const again=api.retryWorkbenchRead(),second=wire.sent.filter(m=>m.type==='refreshCard').at(-1);
 receive('ack',{requestId:second.requestId,ok:true,result:{snapshot:{...snapshot('a',12,5,'Recovered'),access:access(3)}}});await again;
 expect(api.getWorkbench().document.dnd_card_web.name).toBe('Recovered');expect(api.getWorkbench().readFailure).toBeUndefined();
});
