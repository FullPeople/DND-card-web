// A moderate increase from the original 125 px/s. Keep the lane spacing and
// lifetime on the same speed so faster names do not pile up in a single lane.
export const SUPPORTER_SPEED_PX_PER_SECOND=175;
export function supporterFlightTiming(viewportWidth:number,estimatedWidth:number){
 return {
  duration:(viewportWidth+estimatedWidth+50)/SUPPORTER_SPEED_PX_PER_SECOND*1000,
  laneDelay:(estimatedWidth+44)/SUPPORTER_SPEED_PX_PER_SECOND*1000,
 };
}
