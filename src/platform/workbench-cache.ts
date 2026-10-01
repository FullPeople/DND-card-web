import {documentRevision} from '../core/workbenchRevisions';

export type CacheGrant={id:string;itemId:string;itemIds?:string[];key?:string;write:boolean;locked:boolean;documentRevision?:number};
export type CacheAccess={room:string;scope:string;epoch:number;role:string;cards:CacheGrant[];monsters:CacheGrant[];enabled:Record<string,boolean>};
type Snapshot={sequence?:number;state:any;document:any};
type Entry={snapshot:Snapshot;bytes:number};

/** Session memory only. The host's current access directory owns every cache hit. */
export class WorkbenchSnapshotCache {
 private access?:CacheAccess;
 private confirmed=false;
 private entries=new Map<string,Entry>();
 private bytes=0;
 constructor(private readonly limit=24,private readonly byteLimit=24*1024*1024){}
 reset(){this.access=undefined;this.confirmed=false;this.entries.clear();this.bytes=0;}
 suspend(){this.confirmed=false;}
 acceptAccess(next:CacheAccess):boolean {
  if(!next||typeof next.room!=='string'||typeof next.scope!=='string'||!Number.isSafeInteger(next.epoch)||!Array.isArray(next.cards)||!Array.isArray(next.monsters))return false;
  if(this.access&&(next.epoch<this.access.epoch||next.epoch===this.access.epoch&&(next.scope!==this.access.scope||next.room!==this.access.room||next.role!==this.access.role)))return false;
  if(this.access&&(next.scope!==this.access.scope||next.room!==this.access.room||next.role!==this.access.role)){this.entries.clear();this.bytes=0;}
  this.access=next;this.confirmed=true;
  for(const [key,{snapshot}]of this.entries)if(!this.grant(snapshot.state))this.remove(key);
  return true;
 }
 get currentAccess(){return this.access;}
 private grant(target:any):CacheGrant|undefined {
  const access=this.access;if(!access||!target?.key?.startsWith(access.room+':'))return;
  if(target.cardId){if(access.enabled.characterCards===false)return;const card=access.cards.find(card=>card.id===target.cardId);return card&&(!card.itemIds||target.itemId===`card:${card.id}`||card.itemIds.includes(target.itemId))?card:undefined;}
  if(target.kind==='monster'&&access.enabled.bestiary===false||target.kind==='token'&&access.enabled.hpBar===false)return;
  return access.monsters.find(card=>card.itemId===target.itemId&&(!card.key||card.key===target.key));
 }
 permits(target:any){return this.confirmed&&!!this.grant(target);}
 remember(snapshot:Snapshot,access:CacheAccess|undefined){
  if(!access||!this.acceptAccess(access)||snapshot.document===undefined||!snapshot.state||!this.grant(snapshot.state))return false;
  const key=snapshot.state.key,old=this.entries.get(key),revision=documentRevision(snapshot.document,snapshot.state);
  if(old){const previous=documentRevision(old.snapshot.document,old.snapshot.state);if(revision<previous||revision===previous&&(snapshot.sequence||0)<(old.snapshot.sequence||0))return false;}
  const bytes=JSON.stringify(snapshot).length*2;if(bytes>this.byteLimit)return false;
  this.remove(key);this.entries.set(key,{snapshot,bytes});this.bytes+=bytes;
  while(this.entries.size>this.limit||this.bytes>this.byteLimit)this.remove(this.entries.keys().next().value!);
  return true;
 }
 get(id:string,minimumRevision=0):Snapshot|undefined {
  if(!this.confirmed)return;
  for(const [key,entry]of this.entries){const s=entry.snapshot.state;
   if(id!==(s.cardId?'card:'+s.cardId:s.itemId)&&id!==s.itemId)continue;
   const grant=this.grant(s);if(!grant||documentRevision(entry.snapshot.document,s)<Math.max(minimumRevision,grant.documentRevision||0))return;
   this.entries.delete(key);this.entries.set(key,entry);
   return {...entry.snapshot,state:{...s,write:grant.write,locked:grant.locked,role:this.access!.role}};
  }
 }
 private remove(key:string){const old=this.entries.get(key);if(old)this.bytes-=old.bytes;this.entries.delete(key);}
 diagnostics(){return {entries:this.entries.size,bytes:this.bytes,confirmed:this.confirmed,epoch:this.access?.epoch};}
}
