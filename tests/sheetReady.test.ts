import {afterEach,describe,expect,it,vi} from 'vitest';
import {waitForRenderedSheet,type SheetReadiness} from '../src/platform/sheetReady';
afterEach(()=>vi.useRealTimers());
describe('A4 captures await lazy sheet contents',()=>{
 it('does not capture a loading placeholder after frames have passed',async()=>{
  vi.useFakeTimers();let state:SheetReadiness='loading',notify=()=>{};const stop=vi.fn(),done=vi.fn();
  const wait=waitForRenderedSheet(()=>state,check=>{notify=check;return stop;}).then(done);
  vi.advanceTimersByTime(1000);await Promise.resolve();expect(done).not.toHaveBeenCalled();
  state='ready';notify();await wait;expect(done).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('rejects changed cards and cleans up instead of exporting the wrong character',async()=>{
  let state:SheetReadiness='loading',notify=()=>{};const stop=vi.fn();
  const wait=waitForRenderedSheet(()=>state,check=>{notify=check;return stop;});
  state='changed';notify();await expect(wait).rejects.toThrow('已停止导出');expect(stop).toHaveBeenCalledTimes(1);
 });
 it('times out with an error rather than a successful empty file',async()=>{
  vi.useFakeTimers();const stop=vi.fn(),wait=waitForRenderedSheet(()=>'loading',()=>stop,50),assertion=expect(wait).rejects.toThrow('未生成文件');
  vi.advanceTimersByTime(50);await assertion;expect(stop).toHaveBeenCalledTimes(1);
 });
 it('handles readiness becoming true as the observer is installed',async()=>{
  let state:SheetReadiness='loading';const stop=vi.fn();
  await waitForRenderedSheet(()=>state,()=>{state='ready';return stop;});expect(stop).toHaveBeenCalledTimes(1);
 });
 it('does not install an observer for already-ready or replaced paper',async()=>{
  const watch=vi.fn(()=>()=>{});await waitForRenderedSheet(()=>'ready',watch);await expect(waitForRenderedSheet(()=>'changed',watch)).rejects.toThrow('已停止导出');expect(watch).not.toHaveBeenCalled();
 });
 it('cleans up even when a watcher checks synchronously during setup',async()=>{
  vi.useFakeTimers();let state:SheetReadiness='loading';const stop=vi.fn();
  await waitForRenderedSheet(()=>state,check=>{state='ready';check();return stop;});expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
 });
});
