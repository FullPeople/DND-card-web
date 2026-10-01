import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const wire=vi.hoisted(()=>({sent:[] as any[],receive:undefined as undefined|((m:any)=>void),fault:undefined as undefined|((m:any)=>void)}));
vi.mock('../src/platform/relay',()=>({Relay:class{
 constructor(_url:string,_session:string,_role:string,_secret:string,receive:(m:any)=>void,_key:unknown,_alive:unknown,_room:unknown,fault:(m:any)=>void){wire.receive=receive;wire.fault=fault;}
 send(message:any){wire.sent.push(message);return Promise.resolve();}
}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.setSystemTime(Date.parse('2026-10-01T00:00:00Z'));wire.sent=[];
 vi.stubGlobal('window',Object.assign(new EventTarget(),{opener:null}));
 vi.stubGlobal('location',new URL('https://fixture.test/suite-dev/workbench/index.html#suite=instant217&bridge=https%3A%2F%2Ffixture.test&relay=test-key'));
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const card=(id:string,write=true)=>({id,name:id,itemId:'token-'+id,write,locked:false,inScene:true,resources:[],stats:{health:10},documentRevision:1});
const access=(epoch=1,ids=['a','b'],scope='room:scene-1')=>({room:'room',scope,epoch,role:'GM',cards:ids.map(id=>card(id)),monsters:[],enabled:{characterCards:true,bestiary:true,hpBar:true}});
const snapshot=(id:string,sequence:number,revision=1,hp=10)=>({sequence,state:{...card(id),key:'room:card:'+id,cardId:id,kind:'character',role:'GM',pinned:false,documentRevision:revision,stats:{health:hp}},document:{_suiteRevision:revision,identity:{character_name:id},core_stats:{hp:{current:hp,max:20}}}});
const receive=(type:string,extra:Record<string,unknown>={})=>wire.receive!({protocol:'full-suite-workbench/v1',session:'instant217',hostStarted:1,type,...extra});
async function ready(){const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,cards:[card('a'),card('b')],monsters:[],role:'GM',enabled:{characterCards:true}});receive('access',{access:access()});return api;}

describe('cached workbench selection without a relay response on the click path',()=>{
 it('publishes a previously authorized card synchronously before any select reply',async()=>{
  const api=await ready();receive('selection',{...snapshot('a',2),access:access()});receive('selection',{...snapshot('b',3),access:access()});
  api.chooseWorkbench('card:a');
  expect(api.getWorkbench().target?.cardId).toBe('a');expect(api.getWorkbench().document.identity.character_name).toBe('a');
  expect(wire.sent.filter(m=>m.type==='select')).toHaveLength(1);
 });
 it('warms a card in the background without changing the current sheet',async()=>{
  const api=await ready();receive('selection',{...snapshot('b',2),access:access()});receive('cacheSnapshot',{...snapshot('a',3),access:access()});
  expect(api.getWorkbench().target?.cardId).toBe('b');api.chooseWorkbench('card:a');expect(api.getWorkbench().target?.cardId).toBe('a');
 });
 it('uses a newer background document on the next click and rejects old revisions',async()=>{
  const api=await ready();receive('selection',{...snapshot('a',2),access:access()});receive('selection',{...snapshot('b',3),access:access()});
  receive('cacheSnapshot',{...snapshot('a',4,3,7),access:access()});receive('cacheSnapshot',{...snapshot('a',5,2,8),access:access()});api.chooseWorkbench('card:a');
  expect(api.getWorkbench().target?.stats.health).toBe(7);expect(api.getWorkbench().document._suiteRevision).toBe(3);
 });
});

it('rejects a late selection reply after A then B, without waiting to show B',async()=>{
 const api=await ready();receive('cacheSnapshot',{...snapshot('a',2),access:access()});receive('cacheSnapshot',{...snapshot('b',3),access:access()});
 api.chooseWorkbench('card:a');const a=wire.sent.at(-1);api.chooseWorkbench('card:b');const b=wire.sent.at(-1);
 receive('selection',{...snapshot('a',4),access:access(),clientInstance:a.clientInstance,clientSelection:a.clientSelection});expect(api.getWorkbench().target?.cardId).toBe('b');
 receive('selection',{...snapshot('b',5),access:access(),clientInstance:b.clientInstance,clientSelection:b.clientSelection});expect(api.getWorkbench().target?.cardId).toBe('b');
});
it('removes revoked cards immediately and rejects late catalogs, snapshots and receipts',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2),access:access()});const denied=access(2,['b']);receive('access',{access:denied});
 expect(api.getWorkbench().target).toBeUndefined();expect(api.getWorkbench().cards.map(c=>c.id)).toEqual(['b']);
 receive('catalog',{sequence:99,access:access(),cards:[card('a'),card('b')],monsters:[],role:'GM',enabled:{characterCards:true}});
 receive('cacheSnapshot',{...snapshot('a',100,3),access:access()});receive('ack',{requestId:'old',ok:true,result:{snapshot:{...snapshot('a',101,3),access:access()}}});
 api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();expect(api.getWorkbench().cards.map(c=>c.id)).toEqual(['b']);
});
it('applies changed write and lock permissions before the full catalog arrives',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2),access:access()});const readonly=access(2);readonly.cards[0].write=false;readonly.cards[0].locked=true;
 receive('access',{access:readonly});expect(api.getWorkbench().target?.write).toBe(false);expect(api.getWorkbench().target?.locked).toBe(true);
 api.chooseWorkbench('card:b');api.chooseWorkbench('card:a');expect(api.getWorkbench().target?.write).toBe(false);
});
it('does not reuse a document or inventory across scene and role changes',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2,9,5),access:access()});const next=access(2,['a','b'],'room:scene-2');next.role='PLAYER';receive('access',{access:next});
 expect(api.getWorkbench().target).toBeUndefined();expect(api.getWorkbench().inventory).toBeUndefined();api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();
 receive('selection',{...snapshot('a',3,1,19),access:next,clientSelection:1});expect(api.getWorkbench().target?.stats.health).toBe(19);
});
it('requires a fresh permission directory after transport loss and host restart',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2),access:access()});wire.fault!({state:'retrying',message:'unavailable'});api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();
 receive('access',{access:access()});api.chooseWorkbench('card:a');expect(api.getWorkbench().target?.cardId).toBe('a');
 receive('ready',{hostStarted:2});api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();
 receive('cacheSnapshot',{...snapshot('a',99),access:access(),hostStarted:1});expect(api.getWorkbench().target).toBeUndefined();
});
it('waits for an updated document when the catalog advertises a newer revision',async()=>{
 const api=await ready();receive('cacheSnapshot',{...snapshot('a',2),access:access()});receive('catalog',{sequence:3,access:access(),cards:[{...card('a'),documentRevision:2},card('b')],monsters:[],role:'GM',enabled:{characterCards:true}});
 api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();expect(api.getWorkbench().loading).toBe(true);
 receive('selection',{...snapshot('a',4,2,6),access:access(),clientSelection:1});expect(api.getWorkbench().target?.stats.health).toBe(6);
});
it('pushes a new document into the visible card without a click or mutation',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2),access:access()});const sent=wire.sent.length;receive('cacheSnapshot',{...snapshot('a',3,2,4),access:access()});
 expect(api.getWorkbench().target?.stats.health).toBe(4);expect(wire.sent).toHaveLength(sent);
});
it('keeps an ambiguous write pending while cached clicks never replay it',async()=>{
 const api=await ready();receive('selection',{...snapshot('a',2),access:access()});receive('cacheSnapshot',{...snapshot('b',3),access:access()});
 let result='pending';void api.workbenchRequest('save',{native:{synthetic:true}}).then(()=>{result='ack';});const mutation=wire.sent.find(m=>m.type==='save');
 api.chooseWorkbench('card:b');api.chooseWorkbench('card:a');await vi.advanceTimersByTimeAsync(15000);
 expect(wire.sent.filter(m=>m.type==='save')).toHaveLength(1);expect(wire.sent.some(m=>m.type==='requestStatus'&&m.requestId===mutation.requestId)).toBe(true);expect(result).toBe('pending');
 receive('ack',{requestId:mutation.requestId,ok:true,result:{}});await Promise.resolve();expect(result).toBe('ack');
});
it('bounds the memory cache and purges it when the host disables character cards',async()=>{
 const {WorkbenchSnapshotCache}=await import('../src/platform/workbench-cache');const cache=new WorkbenchSnapshotCache(1,100000);const auth=access();
 cache.remember(snapshot('a',1),auth);cache.remember(snapshot('b',2),auth);expect(cache.get('card:a')).toBeUndefined();expect(cache.get('card:b')).toBeDefined();expect(cache.diagnostics().entries).toBe(1);
 cache.acceptAccess({...auth,epoch:2,enabled:{characterCards:false}});expect(cache.get('card:b')).toBeUndefined();expect(cache.diagnostics().entries).toBe(0);
 const tiny=new WorkbenchSnapshotCache(2,10);expect(tiny.remember(snapshot('a',1),auth)).toBe(false);
});

it('invalidates cached token projections when their binding or monster identity changes',async()=>{
 const {WorkbenchSnapshotCache}=await import('../src/platform/workbench-cache');const cache=new WorkbenchSnapshotCache();
 const first={...access(),cards:[{...card('a'),itemIds:['token-a']}]};cache.remember(snapshot('a',1),first);
 cache.acceptAccess({...first,epoch:2,cards:[{...card('a'),itemId:'token-other',itemIds:['token-other']}]});expect(cache.get('card:a')).toBeUndefined();
 const monster={sequence:2,state:{key:'room:token:monster:slug-a',itemId:'monster',kind:'monster'},document:{name:'old'}};
 const permission={...access(3),monsters:[{id:'monster',itemId:'monster',write:true,locked:false,key:monster.state.key}]};cache.remember(monster,permission);expect(cache.get('monster')).toBeDefined();
 cache.acceptAccess({...permission,epoch:4,monsters:[{...permission.monsters[0],key:'room:token:monster:slug-b'}]});expect(cache.get('monster')).toBeUndefined();
});

it('shows a new directory entry before the independent full inventory catalog finishes',async()=>{
 const api=await ready();receive('catalog',{sequence:2,access:access(),cards:[card('a'),card('b')],monsters:[],role:'GM',enabled:{characterCards:true},shared:{key:'room-rules',revision:1},inventory:{publicId:'room-stock',revision:1,containers:{}}});
 receive('directory',{sequence:3,access:access(2,['a','b','c']),cards:[card('a'),card('b'),card('c')],monsters:[],role:'GM',enabled:{characterCards:true}});
 expect(api.getWorkbench().cards.map(c=>c.id)).toEqual(['a','b','c']);expect(api.getWorkbench().shared?.key).toBe('room-rules');expect(api.getWorkbench().inventory?.publicId).toBe('room-stock');
});


it('clears group state at transport loss, restores a handshake snapshot, and clears an older-host capability on a new host',async()=>{
 const {GroupRollTimeline}=await import('../src/platform/groupRoll');const timeline=new GroupRollTimeline();
 window.addEventListener('workbench-group-roll-state',e=>{const d=(e as CustomEvent).detail;timeline.accept(d.hostStarted,d.groupRevision,d.group,d.snapshot);});
 window.addEventListener('workbench-group-roll-reset',e=>{const d=(e as CustomEvent).detail;timeline.reset(d.hostStarted,d.disconnected);});
 await ready();const group={id:'group',phase:'select',targets:[],visible:true,kind:'save',ability:'dex',variant:'normal'};
 receive('groupRollState',{group,groupRevision:4});expect(timeline.group?.id).toBe('group');
 wire.fault!({state:'retrying',message:'unavailable'});expect(timeline.group).toBeNull();
 receive('groupRollState',{group,groupRevision:5});expect(timeline.group).toBeNull();
 receive('ready',{groupRoll:group,groupRevision:4});expect(timeline.group?.id).toBe('group');
 receive('ready',{hostStarted:2});expect(timeline.group).toBeNull();
 receive('groupRollState',{hostStarted:1,group,groupRevision:99});expect(timeline.group).toBeNull();
});

it('clears old-host shared rules and inventory before the replacement host directory arrives',async()=>{
 const api=await ready();receive('catalog',{sequence:2,cards:[card('a')],monsters:[],role:'GM',enabled:{characterCards:true},shared:{key:'old-room-private',revision:1,rules:{customEntries:[{id:'private'}]}},inventory:{publicId:'old-room',revision:1,containers:{}}});
 expect(api.getWorkbench().shared?.key).toBe('old-room-private');receive('ready',{hostStarted:2});
 expect(api.getWorkbench().shared).toBeUndefined();expect(api.getWorkbench().inventory).toBeUndefined();expect(api.getWorkbench().role).toBeUndefined();expect(api.getWorkbench().access).toBeUndefined();
});
it('retains only the already displayed legacy-host card when its own tab is clicked again',async()=>{
 const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,cards:[card('a'),card('b')],monsters:[],role:'GM',enabled:{characterCards:true}});receive('selection',snapshot('a',2));
 const document=api.getWorkbench().document;api.chooseWorkbench('card:a');
 expect(api.getWorkbench().target?.cardId).toBe('a');expect(api.getWorkbench().document).toBe(document);expect(api.getWorkbench().loading).toBe(false);expect(wire.sent.filter(m=>m.type==='select')).toHaveLength(1);
 receive('catalog',{sequence:3,cards:[card('a',false),card('b')],monsters:[],role:'PLAYER',enabled:{characterCards:true}});api.chooseWorkbench('card:a');expect(api.getWorkbench().target?.write).toBe(false);
 api.chooseWorkbench('card:b');expect(api.getWorkbench().target).toBeUndefined();api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();
});
it('does not use the legacy same-card fallback after transport loss or a newer catalog revision',async()=>{
 const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,cards:[card('a')],monsters:[],role:'GM',enabled:{characterCards:true}});receive('selection',snapshot('a',2));
 wire.fault!({state:'retrying',message:'unavailable'});api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();
 receive('ready');receive('catalog',{sequence:3,cards:[card('a')],monsters:[],role:'GM',enabled:{characterCards:true}});receive('selection',{...snapshot('a',4),clientSelection:1});
 receive('catalog',{sequence:5,cards:[{...card('a'),documentRevision:2}],monsters:[],role:'GM',enabled:{characterCards:true}});api.chooseWorkbench('card:a');expect(api.getWorkbench().target).toBeUndefined();expect(api.getWorkbench().loading).toBe(true);
});
