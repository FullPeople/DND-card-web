import {describe,expect,it} from 'vitest';
import {createWheelScroller,type WheelScrollerOptions} from '../src/cloud/galleryWheel';

/** A fake clock whose frames run every 16 ms, like a 60 Hz display. */
function harness(options:Partial<WheelScrollerOptions>={}){
 let clock=0,handle=0;const frames=new Map<number,(time:number)=>void>(),positions:number[]=[],settled:number[]=[];
 const scroller=createWheelScroller({stepSize:70,maxSteps:3,settleDelay:120,now:()=>clock,raf:callback=>{frames.set(++handle,callback);return handle;},caf:id=>{frames.delete(id);},onFrame:position=>positions.push(position),onSettle:steps=>settled.push(steps),...options});
 const run=(ms:number)=>{const end=clock+ms;while(clock<end){clock=Math.min(end,clock+16);for(const [id,callback] of [...frames]){frames.delete(id);callback(clock);}}};
 const idle=()=>run(120+1200);
 return {scroller,run,idle,positions,settled,pending:()=>frames.size,wheel:(delta:number,wait=0)=>{run(wait);scroller.wheel(delta);}};
}
const strictlyIncreasing=(values:number[])=>values.every((value,i)=>i===0||value>=values[i-1]);

describe('gallery wheel scroller',()=>{
 it('accumulates wheel pixels into a continuous position that eases toward the target',()=>{
  const h=harness();h.wheel(35);h.run(48);
  expect(h.positions.length).toBeGreaterThan(1);expect(strictlyIncreasing(h.positions)).toBe(true);
  expect(h.positions.at(-1)!).toBeGreaterThan(.2);expect(h.positions.at(-1)!).toBeLessThan(.5);
  h.wheel(35);h.run(64);expect(h.positions.at(-1)!).toBeGreaterThan(.6);expect(h.positions.at(-1)!).toBeLessThanOrEqual(1);
  expect(h.settled).toEqual([]);expect(h.scroller.active()).toBe(true);
 });
 it('settles to the nearest card once the wheel has been quiet and commits the whole steps',()=>{
  const short=harness();short.wheel(20);short.idle();
  expect(short.settled).toEqual([0]);expect(short.positions.at(-1)).toBe(0);expect(short.scroller.active()).toBe(false);expect(short.pending()).toBe(0);
  const long=harness();long.wheel(50);long.idle();
  expect(long.settled).toEqual([1]);expect(long.positions.at(-1)).toBe(1);expect(Math.max(...long.positions)).toBeLessThanOrEqual(1);
  const back=harness();back.wheel(-120);back.idle();expect(back.settled).toEqual([-2]);expect(back.positions.at(-1)).toBe(-2);
 });
 it('glides monotonically to the settled card without overshoot',()=>{
  const h=harness();h.wheel(100);h.run(40);h.wheel(100);h.idle();
  expect(h.settled).toEqual([3]);expect(strictlyIncreasing(h.positions)).toBe(true);expect(Math.max(...h.positions)).toBe(3);
 });
 it('clamps one burst of input to maxSteps cards in either direction',()=>{
  const forward=harness();for(let i=0;i<12;i++)forward.wheel(140,8);forward.idle();
  expect(forward.settled).toEqual([3]);expect(Math.max(...forward.positions)).toBe(3);
  const reverse=harness();for(let i=0;i<12;i++)reverse.wheel(-140,8);reverse.idle();
  expect(reverse.settled).toEqual([-3]);expect(Math.min(...reverse.positions)).toBe(-3);
  const turned=harness();for(let i=0;i<6;i++)turned.wheel(140,8);for(let i=0;i<8;i++)turned.wheel(-140,8);turned.idle();
  expect(turned.settled).toEqual([-3]);
 });
 it('starts a new burst for a notch that arrives after the gallery caught up, so slow rolling moves one card per notch',()=>{
  const spaced=harness();for(let i=0;i<5;i++)spaced.wheel(70,200);spaced.idle();
  expect(spaced.settled.reduce((sum,steps)=>sum+steps,0)).toBe(5);
  const steady=harness();for(let i=0;i<6;i++)steady.wheel(70,104);steady.idle();
  expect(steady.settled.reduce((sum,steps)=>sum+steps,0)).toBe(6);expect(Math.max(...steady.positions)).toBe(6);
 });
 it('keeps a flick with momentum events inside the clamp even when they are small',()=>{
  const h=harness();h.wheel(150);for(let i=0;i<40;i++)h.wheel(Math.max(2,120-i*6),16);h.idle();
  expect(h.settled).toEqual([3]);expect(Math.max(...h.positions)).toBe(3);
 });
 it('snaps instead of easing when motion is reduced',()=>{
  const h=harness({reducedMotion:()=>true});h.wheel(70);h.run(16);
  expect(h.positions).toEqual([1]);
  h.wheel(30);h.run(16);expect(h.positions.at(-1)).toBeCloseTo(1+30/70,5);
  h.idle();expect(h.settled).toEqual([1]);expect(h.positions.at(-1)).toBe(1);
  const burst=harness({reducedMotion:()=>true});for(let i=0;i<12;i++)burst.wheel(140,8);burst.idle();expect(burst.settled).toEqual([3]);
 });
 it('cancel drops the burst without a frame or a settle callback',()=>{
  const h=harness();h.wheel(100);h.run(16);const frames=h.positions.length;h.scroller.cancel();h.idle();
  expect(h.positions.length).toBe(frames);expect(h.settled).toEqual([]);expect(h.scroller.active()).toBe(false);expect(h.pending()).toBe(0);
  h.wheel(70);h.idle();expect(h.settled).toEqual([1]);
 });
 it('ignores empty or non-finite deltas',()=>{
  const h=harness();h.wheel(0);h.wheel(NaN);h.wheel(Infinity);h.idle();
  expect(h.positions).toEqual([]);expect(h.settled).toEqual([]);expect(h.pending()).toBe(0);
 });
});
