import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
const wire=vi.hoisted(()=>({sent:[] as any[],receive:undefined as undefined|((m:any)=>void)}));
vi.mock('../src/platform/relay',()=>({Relay:class{constructor(_u:string,_s:string,_r:string,_k:string,receive:(m:any)=>void){wire.receive=receive;}send(message:any){wire.sent.push(message);return Promise.resolve();}}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
vi.mock('../src/platform/actionHistory',()=>({recordAction:vi.fn()}));
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();vi.setSystemTime(100000);wire.sent=[];vi.stubGlobal('window',Object.assign(new EventTarget(),{opener:null}));vi.stubGlobal('location',new URL('https://fixture.test/#suite=deferred&bridge=https%3A%2F%2Ffixture.test&relay=fixture'));});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const grant=(write=true)=>({id:'a',name:'Authored',itemId:'token-a',write,locked:false,inScene:true,resources:[],stats:{health:10},documentRevision:1});
const auth=(epoch=1,write=true)=>({room:'room',scope:'scene',epoch,role:'PLAYER',cards:[grant(write)],monsters:[],enabled:{characterCards:true}});
const receive=(type:string,extra:any={})=>wire.receive!({protocol:'full-suite-workbench/v1',session:'deferred',hostStarted:1,type,...extra});
async function ready(){const api=await import('../src/platform/workbench'),c=newCharacter();c.id='suite:room:card:a';c.baseHp=30;c.runtime.hp=10;
 receive('ready');receive('catalog',{sequence:1,access:auth(),cards:[grant()],monsters:[],role:'PLAYER',enabled:{characterCards:true}});
 receive('selection',{sequence:2,state:{...grant(),key:'room:card:a',cardId:'a',kind:'character',role:'PLAYER',pinned:false},document:{dnd_card_web:c,_suiteRevision:1}});return {api,c};}
const saves=()=>wire.sent.filter(m=>m.type==='save');
it('computes only the first baseline and latest draft after a burst, then waits for its ACK',async()=>{
 const {api,c}=await ready(),calls:string[]=[],pending:Promise<any>[]=[];
 let before=c;
 for(let i=0;i<10;i++){const old=before,next={...old,runtime:{...old.runtime,hp:9-i}};
  pending.push(api.patchWorkbenchStats(old,next,()=>{calls.push(`before:${i}`);return evaluate(old);},()=>{calls.push(`after:${i}`);return evaluate(next);})!);before=next;
 }
 expect(calls).toEqual([]);expect(saves()).toHaveLength(0);await vi.advanceTimersByTimeAsync(80);
 expect(calls).toEqual(['before:0','after:9']);expect(saves()).toHaveLength(1);
 expect(saves()[0].delta.native).toContainEqual(expect.objectContaining({path:['runtime','hp'],before:10,after:0}));expect(saves()[0].statPatch.health).toBe(0);
 let resolved=false;void Promise.all(pending).then(()=>{resolved=true;});await Promise.resolve();expect(resolved).toBe(false);
 receive('ack',{requestId:saves()[0].requestId,ok:true,result:{}});await Promise.all(pending);expect(resolved).toBe(true);
});
it('does no expensive work if permission is revoked before the queued send',async()=>{
 const {api,c}=await ready(),compute=vi.fn(()=>evaluate(c)),result=api.patchWorkbenchStats(c,{...c,runtime:{...c.runtime,hp:8}},compute,compute)!.catch(e=>e);
 receive('access',{access:auth(2,false)});await vi.advanceTimersByTimeAsync(80);
 expect(await result).toMatchObject({permissionChanged:true});expect(compute).not.toHaveBeenCalled();expect(saves()).toHaveLength(0);
});
it('rejects all coalesced waiters if derivation fails without sending a partial document',async()=>{
 const {api,c}=await ready(),failed=()=>{throw Error('derive failed');};
 const first=api.patchWorkbenchStats(c,c,failed,()=>evaluate(c))!.catch(e=>e),second=api.patchWorkbenchStats(c,c,()=>evaluate(c),()=>evaluate(c))!.catch(e=>e);
 await vi.advanceTimersByTimeAsync(80);expect((await first).message).toBe('derive failed');expect((await second).message).toBe('derive failed');expect(saves()).toHaveLength(0);
});
