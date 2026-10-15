import {afterEach,expect,it,vi} from 'vitest';
import {afterPaint} from '../src/platform/afterPaint';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function environment(phase='playing'){
 vi.useFakeTimers();const window=new EventTarget(),document={documentElement:{dataset:{cardStartup:phase}}};
 vi.stubGlobal('window',window);vi.stubGlobal('document',document);
 vi.stubGlobal('requestAnimationFrame',(callback:()=>void)=>setTimeout(callback,16));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 return {finish(){document.documentElement.dataset.cardStartup='complete';window.dispatchEvent(new Event('dnd-card-startup'));},phase(value:string){document.documentElement.dataset.cardStartup=value;window.dispatchEvent(new Event('dnd-card-startup'));}};
}
it('invisible paint and transparent fade do not start optional downloads; completion schedules them once',async()=>{
 const env=environment(),action=vi.fn();afterPaint(action);await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();
 env.phase('fading');await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();env.finish();env.finish();await vi.runAllTimersAsync();expect(action).toHaveBeenCalledOnce();
});
it('navigation cancels a pending opening listener and a queued paint',async()=>{
 const env=environment(),action=vi.fn(),cancel=afterPaint(action);cancel();env.finish();await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();
 const queued=afterPaint(action);queued();await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();
});

it('recovering from a failed opening still starts deferred tools without waiting for impossible completion',async()=>{const env=environment(),action=vi.fn();afterPaint(action);env.phase('failed');await vi.runAllTimersAsync();expect(action).toHaveBeenCalledOnce();const recovered=vi.fn();afterPaint(recovered);await vi.runAllTimersAsync();expect(recovered).toHaveBeenCalledOnce();});

it('an opening which finishes in a hidden tab prepares tools without waiting for an animation frame',async()=>{
 const env=environment(),action=vi.fn();let frame!:()=>void;
 vi.stubGlobal('requestAnimationFrame',(callback:()=>void)=>{frame=callback;return 17;});
 afterPaint(action);await vi.advanceTimersByTimeAsync(5000);expect(action).not.toHaveBeenCalled();
 env.finish();await vi.advanceTimersByTimeAsync(1499);expect(action).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);expect(action).toHaveBeenCalledOnce();
 frame();await vi.runAllTimersAsync();expect(action).toHaveBeenCalledOnce();
});

it('a stalled idle callback has the same deadline and cannot later execute the work twice',async()=>{
 environment('complete');const action=vi.fn();let idle!:()=>void;
 Object.assign(window,{requestIdleCallback:(callback:()=>void)=>{idle=callback;return 4;},cancelIdleCallback:vi.fn()});
 afterPaint(action);await vi.advanceTimersByTimeAsync(1499);expect(action).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);expect(action).toHaveBeenCalledOnce();idle();expect(action).toHaveBeenCalledOnce();
 expect(window.cancelIdleCallback).toHaveBeenCalledWith(4);
});

it('cancelling hidden-tab preparation also cancels its fallback',async()=>{
 environment('complete');const action=vi.fn();vi.stubGlobal('requestAnimationFrame',()=>17);
 const cancel=afterPaint(action);await vi.advanceTimersByTimeAsync(1000);cancel();await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();
});

it('a disposed page does not start deferred work through the fallback',async()=>{
 const env=environment('complete'),action=vi.fn();vi.stubGlobal('requestAnimationFrame',()=>17);
 afterPaint(action);env.phase('cancelled');await vi.runAllTimersAsync();expect(action).not.toHaveBeenCalled();
});
