import {afterEach,expect,it,vi} from 'vitest';
import {catalogNormalizer} from '../src/data/catalogNormalizer';
import type {Entry} from '../src/core/model';

afterEach(()=>vi.unstubAllGlobals());
const entries:Entry[]=[{id:'authored',kind:'feature',name:'Authored',english:'Authored',source:'CUSTOM',edition:'both',packId:'authored',revision:'1',entries:[],raw:{}}];

it('an existing reader worker normalizes in its own background realm with the complete operation arguments',async()=>{
 const nested=vi.fn();vi.stubGlobal('Worker',nested);vi.stubGlobal('window',undefined);vi.stubGlobal('self',{postMessage:vi.fn()});
 const fallback=vi.fn(()=>entries),abort=new AbortController(),normalizer=catalogNormalizer(abort.signal,fallback),body={authored:[]};
 expect(await normalizer.normalize(body,'revision','pack','magicItems')).toBe(entries);
 expect(fallback).toHaveBeenCalledExactlyOnceWith(body,'revision','pack','magicItems');expect(nested).not.toHaveBeenCalled();normalizer.dispose();
});

it('a page still uses a separate worker and abort rejects its pending work and terminates that worker',async()=>{
 vi.stubGlobal('window',{});const fallback=vi.fn(()=>entries),terminate=vi.fn(),postMessage=vi.fn();
 const Worker=vi.fn(function(this:any){Object.assign(this,{terminate,postMessage});});vi.stubGlobal('Worker',Worker);
 const abort=new AbortController(),normalizer=catalogNormalizer(abort.signal,fallback),result=normalizer.normalize({},'revision','pack','monsters');
 const rejected=expect(result).rejects.toThrow('资料处理已中止');expect(Worker).toHaveBeenCalledTimes(1);expect(postMessage).toHaveBeenCalledExactlyOnceWith({id:1,body:{},revision:'revision',packId:'pack',operation:'monsters'});
 abort.abort();await rejected;expect(terminate).toHaveBeenCalledTimes(1);expect(fallback).not.toHaveBeenCalled();normalizer.dispose();
});

it('an aborted background reader never runs the synchronous normalizer or creates another worker',async()=>{
 const nested=vi.fn();vi.stubGlobal('Worker',nested);vi.stubGlobal('window',undefined);vi.stubGlobal('self',{postMessage:vi.fn()});
 const fallback=vi.fn(()=>entries),abort=new AbortController();abort.abort();const normalizer=catalogNormalizer(abort.signal,fallback);
 await expect(normalizer.normalize({},'revision')).rejects.toThrow('资料处理已中止');expect(fallback).not.toHaveBeenCalled();expect(nested).not.toHaveBeenCalled();normalizer.dispose();
});
