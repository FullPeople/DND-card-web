import type {Character} from '../src/core/model';

export type Mode='native'|'react'|'compute'|'cached'|'retained';
export type Counts={evaluations:number;choices:number;commits:number;mounts:number;unmounts:number;domAdded:number;domRemoved:number};
export const emptyCounts=():Counts=>({evaluations:0,choices:0,commits:0,mounts:0,unmounts:0,domAdded:0,domRemoved:0});
export const counts=emptyCounts();
export const metricSemantics={
 counts:{
  evaluations:'Calls to evaluate(character), including preparation in the report totals.',
  choices:'Calls to sheetChoices(character, catalog), including preparation in the report totals.',
  commits:'Layout-effect runs of the measured outer CardBody or SimpleCard component; not every React root commit or descendant component commit.',
  mounts:'Effect setup runs of the measured outer Mounted wrapper or SimpleCard component; zero does not imply that descendant DOM elements were retained.',
  unmounts:'Effect cleanup runs of the same measured outer wrapper or component; zero does not imply that descendant DOM elements were retained.',
  domAdded:'Element nodes and their element descendants added under the card stage, observed through childList mutations; excludes text, attribute and style changes.',
  domRemoved:'Element nodes and their element descendants removed from the card stage, observed through childList mutations; excludes text, attribute and style changes.',
 } satisfies Record<keyof Counts,string>,
 totalsWindow:'Report counts accumulate from the selected layer setup reset, including preparation and observed setup DOM mutations; they are not the sum of sample counts.',
 sampleWindow:'Each sample counts the delta from switch-handler start through its first requestAnimationFrame observation; preparation is excluded.',
 commitMs:'Synchronous time around renderer.show, including calculation and React work performed by that mode; not a measurement of pixel paint.',
 nextFrameMs:'Time from switch-handler start to the requestAnimationFrame observation, including frame scheduling; not exact pixel paint time.',
};
export type CardRenderer={show:(index:number)=>void;dispose:()=>void};
export type RendererOptions={host:HTMLElement;cards:Character[];mode:Mode;decoration:boolean;display:'screen'|'a4'};
