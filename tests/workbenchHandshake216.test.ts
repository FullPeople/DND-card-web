import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const wire=vi.hoisted(()=>({sent:[] as {at:number;message:any}[],receive:undefined as undefined|((message:any)=>void),changed:undefined as undefined|((state:any)=>void)}));
vi.mock('../src/platform/relay',()=>({Relay:class{
 constructor(_url:string,_session:string,_role:string,_secret:string,receive:(m:any)=>void,_key:unknown,_alive:unknown,_room:unknown,changed:(s:any)=>void){wire.receive=receive;wire.changed=changed;}
 send(message:any){wire.sent.push({at:Date.now(),message});return Promise.resolve();}
}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
const base=Date.parse('2026-10-01T00:00:00Z');
let browser:EventTarget&{opener:any};
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.setSystemTime(base);wire.sent=[];wire.receive=undefined;wire.changed=undefined;
 browser=Object.assign(new EventTarget(),{opener:null});vi.stubGlobal('window',browser);
 vi.stubGlobal('location',new URL('https://fixture.test/suite-dev/workbench/index.html#suite=test-session&bridge=https%3A%2F%2Ffixture.test&relay=test-key'));
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const message=(type:string,extra:Record<string,unknown>={})=>({protocol:'full-suite-workbench/v1',session:'test-session',hostStarted:1,type,...extra});
const receive=(type:string,extra:Record<string,unknown>={})=>wire.receive!(message(type,extra));
const hellos=()=>wire.sent.filter(r=>r.message.type==='hello');
async function heartbeat(ms:number,hostStarted=1){for(let left=ms;left>0;){const delta=Math.min(left,500);await vi.advanceTimersByTimeAsync(delta);receive('pong',{hostStarted});left-=delta;}}
async function connected(){const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,cards:[],monsters:[]});return api;}

describe('real workbench module initial handshake under live heartbeat traffic',()=>{
 it.each(['neither','ready-only','catalog-only'])('retries a missing handshake when pong continues (%s)',async partial=>{
  await import('../src/platform/workbench');
  if(partial==='ready-only')receive('ready');
  if(partial==='catalog-only')receive('catalog',{sequence:1,cards:[],monsters:[]});
  await heartbeat(20000);
  const retried=hellos().filter(r=>r.at>base);
  expect(retried.length).toBeGreaterThan(0);
  expect(retried[0].at-base).toBeLessThanOrEqual(2000);
  expect(hellos().length).toBeLessThanOrEqual(7);
  expect(wire.sent.every(r=>r.message.type==='hello')).toBe(true);
 });
 it('stops startup retries after both ready and catalog, including a legitimate empty catalog',async()=>{
  const api=await connected();const initial=hellos().length;
  await heartbeat(60000);
  expect(hellos()).toHaveLength(initial);expect(api.getWorkbench().online).toBe(true);expect(api.getWorkbench().cards).toEqual([]);
 });
 it('renews the handshake for a new host epoch despite uninterrupted pong traffic',async()=>{
  await connected();await heartbeat(3000);const previous=hellos().length;const restart=Date.now();
  receive('pong',{hostStarted:2});await heartbeat(2000,2);
  expect(hellos().length).toBeGreaterThan(previous);expect(hellos()[previous].at-restart).toBeLessThanOrEqual(2000);
  receive('ready',{hostStarted:2});receive('catalog',{hostStarted:2,sequence:1,cards:[],monsters:[]});const completed=hellos().length;
  await heartbeat(15000,2);expect(hellos()).toHaveLength(completed);
 });
 it('recovers after a relay fault without repeating an in-flight mutation',async()=>{
  const api=await connected();const saving=api.workbenchRequest('stats',{statPatch:{hp:5}});const saved=wire.sent.find(r=>r.message.type==='stats')!.message;
  wire.changed!({status:503,message:'temporary transport fault',retryAt:Date.now()+1400});await heartbeat(20000);
  expect(hellos().some(r=>r.at>base)).toBe(true);expect(wire.sent.filter(r=>r.message.type==='stats')).toHaveLength(1);
  expect(wire.sent.some(r=>r.message.type==='requestStatus'&&r.message.requestId===saved.requestId)).toBe(true);
  receive('ack',{requestId:saved.requestId,ok:true,result:{}});await saving;
  receive('ready');receive('catalog',{sequence:2,cards:[],monsters:[]});const completed=hellos().length;
  await heartbeat(15000);expect(hellos()).toHaveLength(completed);expect(wire.sent.filter(r=>r.message.type==='stats')).toHaveLength(1);
 });
 it('recovers a direct host that sent ready without its catalog',async()=>{
  await import('../src/platform/workbench');const posted:any[]=[];
  const host:any={closed:false,postMessage:(data:any)=>posted.push({at:Date.now(),data})};host.top=host;
  const direct=(type:string)=>{const event=new Event('message');Object.defineProperties(event,{origin:{value:'https://fixture.test'},source:{value:host},data:{value:message(type)}});browser.dispatchEvent(event);};
  direct('ready');for(let i=0;i<8;i++){await vi.advanceTimersByTimeAsync(500);direct('pong');}
  expect(posted.filter(r=>r.data.type==='hello').length).toBeGreaterThan(0);
  expect(posted.filter(r=>r.data.type==='hello').length).toBeLessThanOrEqual(4);
  expect(posted.every(r=>['hello','ping'].includes(r.data.type))).toBe(true);
 });
 it('does not restart the hello backoff for every repeated transport fault',async()=>{
  await connected();const initial=hellos().length;
  for(let i=0;i<40;i++){wire.changed!({status:503,message:'still unavailable',retryAt:Date.now()+1400});await heartbeat(500);}
  expect(hellos().length-initial).toBeGreaterThan(1);expect(hellos().length-initial).toBeLessThanOrEqual(6);
 });
 it('renews a completed direct handshake after falling back to relay',async()=>{
  await import('../src/platform/workbench');const host:any={closed:false,postMessage:vi.fn()};host.top=host;
  for(const type of ['ready','catalog']){const event=new Event('message');Object.defineProperties(event,{origin:{value:'https://fixture.test'},source:{value:host},data:{value:message(type,{sequence:1,cards:[],monsters:[]})}});browser.dispatchEvent(event);}
  const initial=hellos().length;host.closed=true;await heartbeat(5000);
  expect(hellos().length).toBeGreaterThan(initial);receive('ready');receive('catalog',{sequence:2,cards:[],monsters:[]});const completed=hellos().length;
  await heartbeat(15000);expect(hellos()).toHaveLength(completed);
 });
});
