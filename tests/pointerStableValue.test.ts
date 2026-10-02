import {describe,expect,it} from 'vitest';
import {createPointerStableValue} from '../src/ui/usePointerStableValue';
function fixture(){
 const values:boolean[]=[],pending=new Set<()=>void>();
 const gate=createPointerStableValue(false,value=>values.push(value),callback=>{pending.add(callback);return()=>{pending.delete(callback);};});
 const nextTask=()=>{const tasks=[...pending];pending.clear();for(const task of tasks)task();};
 return {gate,values,pending,nextTask};
}
describe('pointer-stable presentation',()=>{
 it('updates immediately while idle and does not publish on pointer movement or press',()=>{
  const {gate,values}=fixture();gate.update(true);gate.update(true);gate.down(1);expect(values).toEqual([true]);
 });
 it('keeps the target stable through release and its native click, then publishes the latest value',()=>{
  const {gate,values,nextTask}=fixture();gate.down(1);gate.update(true);gate.up(1);expect(values).toEqual([]);gate.update(false);gate.update(true);expect(values).toEqual([]);nextTask();expect(values).toEqual([true]);
 });
 it('waits for every pointer to end, including cancellation',()=>{
  const {gate,values,nextTask}=fixture();gate.down(1);gate.down(2);gate.update(true);gate.up(1);nextTask();expect(values).toEqual([]);gate.up(2);expect(values).toEqual([]);nextTask();expect(values).toEqual([true]);
 });
 it('a new press cancels a queued flush until that gesture also ends',()=>{
  const {gate,values,nextTask}=fixture();gate.down(1);gate.update(true);gate.up(1);gate.down(2);nextTask();expect(values).toEqual([]);gate.up(2);nextTask();expect(values).toEqual([true]);
 });
 it('window blur releases missing pointerups without replaying any action',()=>{
  const {gate,values,nextTask}=fixture();gate.down(1);gate.down(2);gate.update(true);gate.release();expect(values).toEqual([]);nextTask();expect(values).toEqual([true]);
 });
 it('card changes discard an old pending presentation and its scheduled flush',()=>{
  const {gate,values,nextTask}=fixture();gate.down(1);gate.update(true);gate.up(1);gate.reset(false);nextTask();expect(values).toEqual([]);gate.update(true);expect(values).toEqual([true]);
 });
 it('unmount cancels queued work and rejects subsequent notifications',()=>{
  const {gate,values,pending,nextTask}=fixture();gate.down(1);gate.update(true);gate.up(1);gate.dispose();expect(pending.size).toBe(0);nextTask();gate.update(true);gate.release();expect(values).toEqual([]);expect(pending.size).toBe(0);
 });
});
