export const PROTOCOL='dnd-card-window-probe/v1';
export const OWN_HP='com.obr-suite/bubbles/data';
export const LEGACY_HP='com.owlbear-rodeo-bubbles-extension/metadata';
export const BIND='com.character-cards/boundCardId';
export type Snapshot={itemId:string;name:string;hp:number;max:number;binding:string;scope:string;revision:number};
export type Packet={protocol:typeof PROTOCOL;type:string;session?:string;[key:string]:unknown};
export const packet=(type:string,fields:Record<string,unknown>={}):Packet=>({protocol:PROTOCOL,type,...fields});
export function valid(value:unknown):value is Packet{return !!value&&typeof value==='object'&&(value as Packet).protocol===PROTOCOL&&typeof (value as Packet).type==='string';}
export function send(target:Window|null,type:string,fields:Record<string,unknown>,origin:string){try{target?.postMessage(packet(type,fields),origin);}catch{/* A closing window is handled by the heartbeat. */}}
/** Window references are allowed across origins; no foreign DOM is accessed. */
export function discover(root:Window,message:Packet,origin:string){const seen=new Set<Window>();function visit(w:Window,depth:number){if(seen.has(w)||depth>3||seen.size>64)return;seen.add(w);try{w.postMessage(message,origin);for(let i=0;i<w.length;i++)visit(w.frames[i],depth+1);}catch{/* Inaccessible or destroyed iframe. */}}visit(root,0);}
export function originOf(value:string){try{const u=new URL(value);return u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))?u.origin:undefined;}catch{return undefined;}}
