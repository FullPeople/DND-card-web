import {afterEach,beforeEach,expect,it,vi} from 'vitest';

const wire=vi.hoisted(()=>({receive:undefined as undefined|((m:any)=>void),sent:[] as any[]}));
vi.mock('../src/platform/relay',()=>({Relay:class{constructor(_u:string,_s:string,_r:string,_k:string,fn:(m:any)=>void){wire.receive=fn;}send(m:any){wire.sent.push(m);return Promise.resolve();}}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
let browser:EventTarget;
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();vi.setSystemTime(100000);wire.sent=[];browser=Object.assign(new EventTarget(),{opener:null});vi.stubGlobal('window',browser);vi.stubGlobal('location',new URL('https://fixture.test/suite-dev/workbench/#suite=selection223&bridge=https%3A%2F%2Ffixture.test&relay=fixture'));});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const envelope=(type:string,extra:any={})=>({protocol:'full-suite-workbench/v1',session:'selection223',hostStarted:1,type,...extra});
const grant=(id:string)=>({id,itemId:'token-'+id,write:true,locked:false});
const access={room:'room',scope:'scene',epoch:1,role:'GM',enabled:{characterCards:true},cards:['a','b'].map(grant),monsters:[]};
const snapshot=(id:string,sequence:number)=>({sequence,access,state:{...grant(id),cardId:id,key:'room:card:'+id,kind:'character',role:'GM',stats:{health:10}},document:{_suiteRevision:1,identity:{character_name:id}}});
const receive=(type:string,extra:any={})=>wire.receive!(envelope(type,extra));
async function ready(){const api=await import('../src/platform/workbench');receive('ready');receive('catalog',{sequence:1,access,cards:['a','b'].map(grant),monsters:[],role:'GM',enabled:{characterCards:true}});receive('selection',snapshot('a',2));receive('cacheSnapshot',snapshot('b',3));return api;}
function directHost(){const posted:any[]=[];const host:any={closed:false,postMessage:(m:any)=>posted.push(m)};host.top=host;const deliver=(type:string,extra:any={})=>{const e=new Event('message');Object.defineProperties(e,{origin:{value:'https://fixture.test'},source:{value:host},data:{value:envelope(type,extra)}});browser.dispatchEvent(e);};return {host,posted,deliver};}

it('keeps a warm direct session and selected group through a six second heartbeat delay',async()=>{
 const api=await ready(),d=directHost(),resets:any[]=[];d.deliver('ready');d.deliver('catalog',{sequence:4,cards:['a','b'].map(grant),monsters:[]});
 browser.addEventListener('workbench-group-roll-reset',e=>resets.push((e as CustomEvent).detail));
 await vi.advanceTimersByTimeAsync(6000);
 expect(resets).toEqual([]);expect(api.workbenchDiagnostics().transport).toBe('direct');expect(wire.sent.filter(m=>m.type==='hello')).toHaveLength(1);
 api.chooseWorkbench('card:b');expect(api.getWorkbench().target?.cardId).toBe('b');
});
it('rejects older map navigation and selection arriving after a newer follow revision',async()=>{
 const api=await ready();receive('navigate',{itemId:'card:b',followRevision:2,followSelection:true});
 receive('navigate',{itemId:'card:a',followRevision:1,followSelection:true});receive('selection',{...snapshot('a',10),followRevision:1});
 expect(api.getWorkbench().target?.cardId).toBe('b');
});
it('does not erase authorized warm cards for an unrelated pong after a delayed direct reply',async()=>{
 const api=await ready(),d=directHost();d.deliver('ready');d.deliver('catalog',{sequence:4,cards:['a','b'].map(grant),monsters:[]});
 await vi.advanceTimersByTimeAsync(16000);d.deliver('pong');
 expect(api.workbenchDiagnostics().transport).toBe('direct');
});

it('renews an idle relay session with lightweight pings without reopening the handshake',async()=>{
 const api=await ready();
 for(let n=0;n<9;n++){await vi.advanceTimersByTimeAsync(10000);receive('pong');}
 expect(api.getWorkbench().online).toBe(true);
 expect(wire.sent.filter(m=>m.type==='hello')).toHaveLength(1);
 expect(wire.sent.filter(m=>m.type==='ping').length).toBeGreaterThanOrEqual(9);
 api.chooseWorkbench('card:b');expect(api.getWorkbench().target?.cardId).toBe('b');
});
it('does not adopt an unrelated window or an older host epoch as the recovered direct host',async()=>{
 const api=await ready(),known=directHost();known.deliver('ready');
 await vi.advanceTimersByTimeAsync(16000);
 const foreign=directHost();foreign.deliver('pong');expect(api.workbenchDiagnostics().transport).toBe('relay');
 known.deliver('pong',{hostStarted:0.5});expect(api.workbenchDiagnostics().transport).toBe('relay');
 known.deliver('pong');expect(api.workbenchDiagnostics().transport).toBe('direct');
});
