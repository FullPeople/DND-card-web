import type {Character} from '../src/core/model';

export type Mode='native'|'react'|'compute'|'cached'|'retained';
export type Counts={evaluations:number;choices:number;commits:number;mounts:number;unmounts:number;domAdded:number;domRemoved:number};
export const emptyCounts=():Counts=>({evaluations:0,choices:0,commits:0,mounts:0,unmounts:0,domAdded:0,domRemoved:0});
export const counts=emptyCounts();
export type CardRenderer={show:(index:number)=>void;dispose:()=>void};
export type RendererOptions={host:HTMLElement;cards:Character[];mode:Mode;decoration:boolean;display:'screen'|'a4'};
