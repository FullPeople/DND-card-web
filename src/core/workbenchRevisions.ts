/** Transport sequence orders one host only. Durable revisions survive reconnects. */
export function documentRevision(document:any,state?:any):number {
 const value=state?.documentRevision??document?._suiteRevision;
 return Number.isSafeInteger(value)&&value>=0?value:0;
}
const presentationFields=['resourceWidgets','resourceAttacks','resourceHidden','classSummary'] as const;
const runtimeFields=['stats','resources','conditions','documentRevision',...presentationFields] as const;
function retainRuntime<T extends Record<string,any>>(incoming:T,latest:Record<string,any>):T {
 const result={...incoming};
 for(const key of runtimeFields)if(latest[key]!==undefined)(result as any)[key]=latest[key];
 return result;
}
/** Keep permissions from the new message even when its runtime payload is stale. */
export class WorkbenchRevisions {
 private documents=new Map<string,any>();
 private cards=new Map<string,any>();
 // Retiring a readable grant releases its full body, not its anti-rollback
 // floor. Keep only a number here: a tombstone must not retain the old message.
 private released=new Map<string,number>();
 releaseUnreadable(permits:(target:any)=>boolean){
  for(const [key,old] of this.documents)if(!permits(old.state)){
   this.released.set(key,Math.max(this.released.get(key)||0,documentRevision(old.document,old.state)));
   this.documents.delete(key);
  }
 }
 acceptsSnapshot(message:any){
  const key=message?.state?.key;
  return !key||message.document===undefined||message.document===null||documentRevision(message.document,message.state)>=(this.released.get(key)||0);
 }
 snapshot(message:any){
  const key=message?.state?.key;if(!key||message.document===undefined||message.document===null)return message;
  const revision=documentRevision(message.document,message.state),old=this.documents.get(key);
  // With no retained current body, a lower revision cannot be normalized into
  // a usable snapshot. The caller must keep waiting for current authorized data.
  if(!this.acceptsSnapshot(message))return;
  if(old&&revision<documentRevision(old.document,old.state))return {...message,document:old.document,state:retainRuntime(message.state,old.state)};
  const document=old&&revision>0&&revision===documentRevision(old.document,old.state)?old.document:message.document,native=document?.dnd_card_web;
  const presentation=native?{resourceWidgets:native.quickbarLayout?.widgets||{},resourceAttacks:native.quickbarLayout?.attacks,resourceHidden:native.quickbarLayout?.hidden||[],classSummary:native.selections?.filter((row:any)=>row.entry?.kind==='class')||[]}:{ };
  const normalized={...message,document,state:{...message.state,...presentation,documentRevision:revision}};
  this.released.delete(key);
  this.documents.set(key,normalized);
  if(message.state.cardId)this.card({id:message.state.cardId,...normalized.state});
  return normalized;
 }
 card<T extends Record<string,any>>(incoming:T):T {
  const old=this.cards.get(incoming.id);
  if(old&&(incoming.documentRevision??0)<(old.documentRevision??0))return retainRuntime(incoming,old);
  if(old&&(incoming.documentRevision??0)===(old.documentRevision??0))for(const key of presentationFields)if(incoming[key]===undefined&&old[key]!==undefined)incoming={...incoming,[key]:old[key]};
  this.cards.set(incoming.id,incoming);return incoming;
 }
}
/** Access scopes may expose different containers; never restore a previous scope's data. */
export function currentInventory<T extends {publicId:string;revision:number;access?:string}>(previous:T|undefined,incoming:T|undefined):T|undefined {
 return previous&&incoming&&previous.publicId===incoming.publicId&&previous.access===incoming.access&&previous.revision>incoming.revision?previous:incoming;
}
