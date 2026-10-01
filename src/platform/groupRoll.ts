import {useSyncExternalStore} from 'react';
export type GroupTarget={itemId:string;key:string;name:string;ability:Record<string,number>;saves:Record<string,number>;initiative:number;hidden:boolean;result?:number;applied?:boolean;uncertain?:boolean;error?:string};
export type GroupRollState={id:string;phase:'select'|'rolling'|'resolve'|'settled';targets:GroupTarget[];selectedCount?:number;visible:boolean;kind:'save'|'ability'|'initiative';ability:string;variant:'normal'|'adv'|'dis';field?:'health'|'max health'|'armor class';adjustment?:{field:string;mode:string;value:number;pending:boolean};dc?:number;value?:number;mode?:'damage'|'heal'|'set';error?:string};
export class GroupRollTimeline{
 host=0;revision=-1;group:GroupRollState|null=null;disconnected=false;
 reset(host:number,disconnected=false){
  if(!Number.isFinite(host)||host<this.host)return false;
  if(host>this.host){this.host=host;this.revision=-1;this.disconnected=false;}
  this.disconnected ||= disconnected;this.group=null;return true;
 }
 accept(host:number,revision:number,group:GroupRollState|null,snapshot=false){
  if(!Number.isFinite(host)||host<this.host||!Number.isInteger(revision)||revision<0)return false;
  if(host===this.host&&(this.disconnected&&!snapshot||revision<this.revision||revision===this.revision&&!(this.disconnected&&snapshot)))return false;
  this.host=host;this.revision=revision;this.group=group;this.disconnected=false;return true;
 }
}
const timeline=new GroupRollTimeline(),listeners=new Set<()=>void>();
if(typeof window!=='undefined')window.addEventListener('workbench-group-roll-state',event=>{const data=(event as CustomEvent).detail;if(timeline.accept(data?.hostStarted,data?.groupRevision,data?.group||null,!!data?.snapshot))for(const fn of listeners)fn();});
if(typeof window!=='undefined')window.addEventListener('workbench-group-roll-reset',event=>{const data=(event as CustomEvent).detail;if(timeline.reset(data?.hostStarted,!!data?.disconnected))for(const fn of listeners)fn();});
export const useGroupRoll=()=>useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>timeline.group);
