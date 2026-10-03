import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MonsterRuntime,runtimeFrom} from '../src/core/workbenchRuntime';

const wire=vi.hoisted(()=>({receive:undefined as undefined|((m:any)=>void),sent:[] as any[]}));
vi.mock('../src/platform/relay',()=>({Relay:class{constructor(_u:string,_s:string,_r:string,_k:string,fn:(m:any)=>void){wire.receive=fn;}send(m:any){wire.sent.push(m);return Promise.resolve();}}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();wire.sent=[];vi.stubGlobal('window',Object.assign(new EventTarget(),{opener:null}));vi.stubGlobal('location',new URL('https://fixture.test/#suite=monster234&bridge=https%3A%2F%2Ffixture.test&relay=fixture'));});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const resource={id:'breath',name:'吐息',current:1,max:3},invisible={id:'invisible',name:'隐形'};
const monster=(extra:any={})=>({id:'m',itemId:'m',targetId:'monster:m',kind:'monster',name:'桥卫',write:true,locked:false,inScene:true,stats:{health:15,'max health':30},resources:[resource],conditions:[],...extra});
const character=()=>({id:'c',cardId:'c',itemId:'m',kind:'character',name:'旅人',write:true,locked:false,inScene:true,stats:{health:20},resources:[{id:'ink',current:2,max:4}],conditions:[],documentRevision:1});
const access=(epoch=1)=>({room:'room',scope:'scene',epoch,role:'GM',enabled:{characterCards:true,bestiary:true,hpBar:true},cards:[{...character(),itemIds:['m']}],monsters:[{...monster(),key:'room:token:m:guard'}]});
const snapshot=(sequence:number,extra:any={},document:any={name:'桥卫',source:'CUSTOM'})=>({sequence,state:{...monster(),key:'room:token:m:guard',cardId:'',slug:'guard',role:'GM',pinned:false,...extra},document});
const receive=(type:string,extra:any={})=>wire.receive!({protocol:'full-suite-workbench/v1',session:'monster234',hostStarted:1,type,...extra});
async function ready(){const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,access:access(),cards:[character()],monsters:[monster()],role:'GM',enabled:access().enabled});receive('selection',snapshot(2));return api;}
const ack=(snap:any,batch=true)=>receive('ack',{ok:true,requestId:'fixture',result:batch?{snapshots:[snap]}:{snapshot:snap}});

describe('runtime transport normalization',()=>{
 it('preserves omitted and malformed collections but accepts explicit clearing',()=>{
  const previous=monster();expect(runtimeFrom({conditions:[invisible]},previous)).toEqual({stats:previous.stats,resources:[resource],conditions:[invisible]});
  expect(runtimeFrom({resources:null,conditions:{bad:true},stats:'bad'},previous)).toEqual(runtimeFrom(previous));
  expect(runtimeFrom({resources:[null,17],conditions:[null]}, {...previous,conditions:[invisible]})).toEqual(runtimeFrom({...previous,conditions:[invisible]}));
  expect(runtimeFrom({resources:[],conditions:[]},previous).resources).toEqual([]);
 });
 it('reads legacy resource maps and malformed condition entries without mutating input',()=>{
  const input={resources:{breath:{name:'吐息',current:'1',max:'3'},bad:null},conditions:[null,42,'prone',{id:'invisible',entry:{id:'catalog-invisible',raw:null,entries:null}}],stats:{health:'12',bad:NaN}};
  const before=structuredClone(input),value=runtimeFrom(input);
  expect(value.resources).toEqual([resource]);expect(value.stats).toEqual({health:12});expect(value.conditions.map(r=>r.id)).toEqual(['prone','invisible']);expect(value.conditions[1].entry?.raw).toEqual({});expect(value.conditions[1].entry?.entries).toEqual([]);expect(input).toEqual(before);
 });
 it('orders monster documents and runtime together across partial catalogs',()=>{
  const gate=new MonsterRuntime();gate.snapshot(snapshot(5,{conditions:[invisible]},{name:'New'}));
  const stale=gate.snapshot(snapshot(4,{resources:[],conditions:[]},{name:'Old'}));expect(stale.document.name).toBe('New');expect(stale.state.conditions).toEqual([invisible]);
  const partial=gate.catalog(monster({resources:undefined,conditions:undefined,stats:{health:9}}),6);expect(partial.resources).toEqual([resource]);expect(partial.stats['max health']).toBe(30);
 });
});

for(const batch of [true,false])it(`${batch?'batch condition':'single stat'} receipt keeps absent resources, statistics and conditions coherent`,async()=>{
 const api=await ready();ack(snapshot(3,{resources:undefined,conditions:[invisible],stats:{health:12}}),batch);
 expect(()=>api.getWorkbench().monsters[0].resources.map(r=>r.id)).not.toThrow();expect(api.getWorkbench().monsters[0].resources).toEqual([resource]);expect(api.getWorkbench().target?.resources).toEqual([resource]);expect(api.getWorkbench().monsters[0].conditions).toEqual([invisible]);expect(api.getWorkbench().target?.stats['max health']).toBe(30);
 ack(snapshot(4,{resources:[],conditions:[]}),batch);expect(api.getWorkbench().monsters[0].resources).toEqual([]);expect(api.getWorkbench().monsters[0].conditions).toEqual([]);
});
it('handles cold malformed directory rows, a partial ACK and a later valid refresh',async()=>{
 const api=await import('../src/platform/workbench');receive('ready');receive('directory',{sequence:1,cards:[character()],monsters:[monster({resources:null,conditions:[null,{id:'invisible',entry:{id:'e'}}],stats:null})]});
 expect(api.getWorkbench().monsters[0].resources).toEqual([]);expect(api.getWorkbench().monsters[0].conditions?.[0].entry?.raw).toEqual({});
 ack(snapshot(2,{resources:undefined,conditions:undefined,stats:undefined}));expect(api.getWorkbench().monsters[0].resources).toEqual([]);
 receive('catalog',{sequence:3,cards:[character()],monsters:[monster()],enabled:{}});expect(api.getWorkbench().monsters[0].resources).toEqual([resource]);
});
it('does not revive removed conditions or spent resources from older ACKs, catalogs or cache messages',async()=>{
 const api=await ready();ack(snapshot(8,{conditions:[],resources:[{...resource,current:0}]},{name:'Updated'}));
 receive('catalog',{sequence:6,cards:[character()],monsters:[monster({conditions:[invisible]})],enabled:access().enabled});ack(snapshot(7,{conditions:[invisible]},{name:'Old'}));receive('cacheSnapshot',snapshot(5,{conditions:[invisible]}));
 expect(api.getWorkbench().monsters[0].resources[0].current).toBe(0);expect(api.getWorkbench().monsters[0].conditions).toEqual([]);expect(api.getWorkbench().target?.conditions).toEqual([]);expect(api.getWorkbench().document.name).toBe('Updated');
 api.chooseWorkbench('monster:m');expect(api.getWorkbench().target?.resources?.[0].current).toBe(0);
});
it('updates the overview from a background snapshot even when another card is selected',async()=>{
 const api=await ready();receive('selection',{sequence:3,state:{...character(),key:'room:card:c'},document:{_suiteRevision:1}});
 receive('cacheSnapshot',snapshot(4,{conditions:[invisible],resources:undefined}));expect(api.getWorkbench().target?.cardId).toBe('c');expect(api.getWorkbench().monsters[0].conditions).toEqual([invisible]);
});
it('isolates dual-bound character and monster runtime in both receipt directions',async()=>{
 const api=await ready();ack({sequence:3,state:{...character(),key:'room:card:c',conditions:[{id:'blinded',name:'目盲'}]},document:{_suiteRevision:1}});
 expect(api.getWorkbench().monsters[0].resources).toEqual([resource]);expect(api.getWorkbench().monsters[0].conditions).toEqual([]);
 ack(snapshot(4,{conditions:[invisible]}));expect(api.getWorkbench().cards[0].resources[0].id).toBe('ink');expect(api.getWorkbench().cards[0].conditions?.[0].id).toBe('blinded');
});
it('switches cached dual-bound identities and rejects a late response for the other identity',async()=>{
 const api=await ready();receive('cacheSnapshot',{sequence:3,state:{...character(),key:'room:card:c'},document:{_suiteRevision:1}});
 api.chooseWorkbench('card:c');expect(api.getWorkbench().target?.kind).toBe('character');api.chooseWorkbench('monster:m');expect(api.getWorkbench().target?.kind).toBe('monster');
 receive('selection',{sequence:5,state:{...character(),key:'room:card:c'},document:{_suiteRevision:1}});expect(api.getWorkbench().target?.kind).toBe('monster');
 const promise=api.workbenchRequest('monsterSave',{data:{name:'Updated'}});expect(wire.sent.at(-1).itemId).toBe('monster:m');receive('ack',{requestId:wire.sent.at(-1).requestId,ok:true,result:{}});await promise;
});
it('routes explicit monster vitals without using the dual-bound character values',async()=>{
 const api=await ready(),{saveVital}=await import('../src/platform/stats');const promise=saveVital(api.getWorkbench().monsters[0],'health','-1','生命');await Promise.resolve();await Promise.resolve();
 const request=wire.sent.find(m=>m.type==='stats');expect(request.itemId).toBe('monster:m');expect(request.expected.health).toBe(15);receive('ack',{requestId:request.requestId,ok:true,result:{snapshot:snapshot(3,{stats:{health:14}})}});expect(await promise).toBe(14);
});
it('purges revoked monster state and does not reintroduce it with a late background response',async()=>{
 const api=await ready();const denied={...access(2),monsters:[]};receive('access',{access:denied});receive('cacheSnapshot',snapshot(9,{conditions:[invisible]}));expect(api.getWorkbench().monsters).toEqual([]);expect(api.getWorkbench().target).toBeUndefined();
 receive('catalog',{sequence:10,access:access(3),cards:[character()],monsters:[monster({resources:undefined})],enabled:access().enabled});expect(api.getWorkbench().monsters[0].resources).toEqual([]);
});
it('starts fresh after host restart rather than carrying old monster runtime',async()=>{
 const api=await ready();ack(snapshot(10,{conditions:[invisible]}));receive('ready',{hostStarted:2});receive('catalog',{hostStarted:2,sequence:1,cards:[],monsters:[monster({conditions:undefined,resources:undefined})],enabled:access().enabled});
 expect(api.getWorkbench().monsters[0].conditions).toEqual([]);expect(api.getWorkbench().monsters[0].resources).toEqual([]);
});
it('does not restore revoked write permissions with a late monster receipt',async()=>{
 const api=await ready(),readonly=access(2);readonly.monsters[0].write=false;readonly.monsters[0].locked=true;receive('access',{access:readonly});ack(snapshot(3,{write:true,locked:false,conditions:[invisible]}));
 expect(api.getWorkbench().target?.write).toBe(false);expect(api.getWorkbench().target?.locked).toBe(true);expect(api.getWorkbench().monsters[0].write).toBe(false);
});
it('keeps HP-only token overview identity when typed permission grants update it',async()=>{
 const api=await ready();receive('catalog',{sequence:3,access:access(2),cards:[character()],monsters:[monster({kind:'token'})],enabled:access().enabled});const next=access(3);next.monsters[0].kind='token';receive('access',{access:next});
 expect(api.getWorkbench().monsters[0].kind).toBe('monster');const {saveVital}=await import('../src/platform/stats');const promise=saveVital(api.getWorkbench().monsters[0],'health','-1','生命');await Promise.resolve();await Promise.resolve();const request=wire.sent.find(m=>m.type==='stats');expect(request.itemId).toBe('monster:m');receive('ack',{requestId:request.requestId,ok:true,result:{snapshot:snapshot(4,{kind:'token',stats:{health:14}})}});await promise;
});
it('uses current access permissions instead of stale catalog flags',async()=>{
 const api=await ready(),next=access(2);next.monsters[0].write=false;next.monsters[0].locked=true;receive('access',{access:next});receive('catalog',{sequence:3,cards:[character()],monsters:[monster()],enabled:access().enabled});expect(api.getWorkbench().monsters[0].write).toBe(false);expect(api.getWorkbench().monsters[0].locked).toBe(true);
});
it('keeps overview dashboard presentation through partial runtime normalization and explicit clears',()=>{
 const presentation={resourceWidgets:{breath:{x:2,y:1,w:3,h:3,page:1,style:'ring'}},resourceAttacks:{x:0,y:0,w:3,h:4,page:0},resourceHidden:['resource:breath'],classSummary:[{id:'class-fixture'}]};
 const before={...monster(),...presentation},partial=runtimeFrom({conditions:[invisible]},before);expect(partial).toMatchObject(presentation);expect(partial.resources).toEqual([resource]);
 expect(runtimeFrom({resourceWidgets:{},resourceHidden:[],classSummary:[]},before)).toMatchObject({resourceWidgets:{},resourceHidden:[],classSummary:[],resourceAttacks:presentation.resourceAttacks});
});
it('projects updated character dashboard layouts without cross-writing dual-bound monster runtime',async()=>{
 const api=await ready(),widgets={ink:{x:4,y:1,w:3,h:3,page:1,style:'ring'}},attacks={x:0,y:0,w:4,h:6,page:0},hidden=['resource:ink'];
 ack({sequence:3,state:{...character(),key:'room:card:c',documentRevision:2,resources:undefined},document:{_suiteRevision:2,dnd_card_web:{quickbarLayout:{widgets,attacks,hidden},selections:[]}}},false);
 expect(api.getWorkbench().cards[0]).toMatchObject({resourceWidgets:widgets,resourceAttacks:attacks,resourceHidden:hidden});expect(api.getWorkbench().cards[0].resources[0].id).toBe('ink');
 ack(snapshot(4,{conditions:[invisible],resources:undefined}));receive('catalog',{sequence:5,cards:[{...character(),documentRevision:2,resources:undefined}],monsters:[monster({resources:undefined,conditions:undefined})],enabled:access().enabled});
 expect(api.getWorkbench().cards[0]).toMatchObject({resourceWidgets:widgets,resourceAttacks:attacks,resourceHidden:hidden});expect(api.getWorkbench().monsters[0].resources).toEqual([resource]);expect(api.getWorkbench().monsters[0].conditions).toEqual([invisible]);
 ack({sequence:6,state:{...character(),key:'room:card:c',documentRevision:3},document:{_suiteRevision:3,dnd_card_web:{quickbarLayout:{widgets:{},hidden:[]},selections:[]}}});expect(api.getWorkbench().cards[0].resourceWidgets).toEqual({});expect(api.getWorkbench().cards[0].resourceHidden).toEqual([]);
});
