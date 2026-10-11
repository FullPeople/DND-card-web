/** Wheel navigation for the card gallery: input accumulates into a continuous
 * position measured in card steps, the position eases toward it on every frame,
 * and once the wheel has been quiet for `settleDelay` the position glides to the
 * nearest card and the whole steps are committed. A burst of input (a flick with
 * its momentum events) can never queue more than `maxSteps` cards; a deliberate
 * notch that arrives after the gallery has caught up starts a new burst, so a
 * mouse rolled one notch at a time still moves one card per notch. Pure logic:
 * the clock and the frame scheduler are injected so tests can drive it. */
export type WheelScrollerOptions={
 /** Wheel pixels that make one card step. */stepSize?:number;
 /** Largest number of cards one input burst may travel. */maxSteps?:number;
 /** Quiet time in ms after which the position settles on a card. */settleDelay?:number;
 /** A spaced full-step notch while the position is this close to its target re-opens the burst window. */catchUp?:number;
 /** Snap to the target instead of easing. Read at every event so a media query can change. */reducedMotion?:()=>boolean;
 now?:()=>number;raf?:(callback:(time:number)=>void)=>number;caf?:(handle:number)=>void;
 /** Continuous position relative to the card that was current when the burst started: positive moves forward. */onFrame:(position:number)=>void;
 /** Whole steps committed once the position has settled; the next burst starts at 0 again. */onSettle:(steps:number)=>void;
};
export type WheelScroller={
 /** Feed wheel pixels, positive for the next card. */wheel:(delta:number)=>void;
 /** Drop the burst without settling (keyboard, buttons or a pointer took over). */cancel:()=>void;
 /** True while input is being followed or the position still glides. */active:()=>boolean;
 /** Current eased position in card steps. */position:()=>number;
};
const clamp=(value:number,low:number,high:number)=>Math.min(high,Math.max(low,value));
export function createWheelScroller({stepSize=70,maxSteps=3,settleDelay=120,catchUp=.25,reducedMotion=()=>false,now=()=>performance.now(),raf=callback=>requestAnimationFrame(callback),caf=handle=>cancelAnimationFrame(handle),onFrame,onSettle}:WheelScrollerOptions):WheelScroller{
 let origin=0,target=0,position=0,lastInput=-Infinity,lastTick=0,frame=0,running=false,settling=false;
 function reset(){origin=target=position=0;running=false;settling=false;}
 function tick(time:number){
  frame=0;const step=clamp(time-lastTick,0,100);lastTick=time;
  if(!settling&&time-lastInput>=settleDelay){settling=true;target=Math.round(target);}
  // Ease out toward the target, but never slower than a small crawl so the glide ends in bounded time.
  const gap=target-position,eased=gap*(1-Math.exp(-step/(settling?90:60))),crawl=Math.min(Math.abs(gap),.004*step);
  if(reducedMotion())position=target;else position+=Math.abs(eased)>crawl?eased:Math.sign(gap)*crawl;
  if(Math.abs(target-position)<1e-6)position=target;
  onFrame(position);
  if(settling&&position===target){const steps=Math.round(position);reset();onSettle(steps);return;}
  frame=raf(tick);
 }
 return {
  wheel(delta){
   if(!Number.isFinite(delta)||!delta)return;
   // A discrete notch (a full step, spaced like a hand on a wheel rather than momentum at frame rate) that lands after the gallery has caught up re-opens the burst window.
   const time=now(),quiet=time-lastInput>=settleDelay,notch=time-lastInput>=40&&Math.abs(delta)>=stepSize*.9&&Math.abs(target-position)<catchUp;
   if(!running){running=true;origin=target=position=0;lastTick=time;}
   else if(quiet||(!reducedMotion()&&notch))origin=target;
   settling=false;lastInput=time;
   target=clamp(target+delta/stepSize,origin-maxSteps,origin+maxSteps);
   if(!frame)frame=raf(tick);
  },
  cancel(){if(frame)caf(frame);frame=0;lastInput=-Infinity;reset();},
  active:()=>running,
  position:()=>position,
 };
}
