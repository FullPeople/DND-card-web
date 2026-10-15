import {expect,test,vi} from 'vitest';
import {preloadModules} from '../src/platform/preloadQueue';
test('the first page modules start ahead of tools with bounded parallelism',async()=>{
 let release!:()=>void;const gate=new Promise<void>(done=>release=done),started:string[]=[],report=vi.fn();let active=0,maximum=0;
 const work=preloadModules(['pages','spells','inventory','tools'].map(name=>({name,load:async()=>{started.push(name);maximum=Math.max(maximum,++active);await gate;active--;}})),report,2);
 expect(started).toEqual(['pages','spells']);release();await work;expect(maximum).toBe(2);expect(report).toHaveBeenCalledTimes(4);
});
test('one failed module does not prevent later tools from warming',async()=>{
 const report=vi.fn(),later=vi.fn(async()=>{});
 await preloadModules([{name:'broken',load:async()=>{throw Error('offline');}},{name:'retained',load:later}],report,1);
 expect(later).toHaveBeenCalledOnce();expect(report.mock.calls.map(([result])=>result)).toEqual([{name:'broken',ok:false},{name:'retained',ok:true}]);
});
test('an empty preload list completes without inventing a successful tool',async()=>{
 const report=vi.fn();await preloadModules([],report);expect(report).not.toHaveBeenCalled();
});
