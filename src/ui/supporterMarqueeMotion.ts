// Travel and lane clearance share one speed, so larger names stay separated.
export const SUPPORTER_SPEED_PX_PER_SECOND=240;
export function supporterFlightTiming(viewportWidth:number,estimatedWidth:number){
 return {
  duration:(viewportWidth+estimatedWidth+50)/SUPPORTER_SPEED_PX_PER_SECOND*1000,
  laneDelay:(estimatedWidth+44)/SUPPORTER_SPEED_PX_PER_SECOND*1000,
 };
}
