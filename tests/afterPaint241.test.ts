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
