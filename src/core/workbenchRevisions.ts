/** Transport sequence orders one host only. Durable revisions survive reconnects. */
export function documentRevision(document:any,state?:any):number {
 const value=state?.documentRevision??document?._suiteRevision;
 return Number.isSafeInteger(value)&&value>=0?value:0;
}
const runtimeFields=['stats','resources','conditions','documentRevision'] as const;
function retainRuntime<T extends Record<string,any>>(incoming:T,latest:Record<string,any>):T {
 const result={...incoming};
 for(const key of runtimeFields)if(latest[key]!==undefined)(result as any)[key]=latest[key];
 return result;
}
/** Keep permissions from the new message even when its runtime payload is stale. */
export class WorkbenchRevisions {
 private documents=new Map<string,any>();
 private cards=new Map<string,any>();
 snapshot(message:any){
  const key=message.state?.key;if(!key||message.document===undefined||message.document===null)return message;
  const revision=documentRevision(message.document,message.state),old=this.documents.get(key);
  if(old&&revision<documentRevision(old.document,old.state))return {...message,document:old.document,state:retainRuntime(message.state,old.state)};
  const normalized={...message,state:{...message.state,documentRevision:revision}};
  this.documents.set(key,normalized);
  if(message.state.cardId)this.card({id:message.state.cardId,...normalized.state});
  return normalized;
 }
 card<T extends Record<string,any>>(incoming:T):T {
  const old=this.cards.get(incoming.id);
  if(old&&(incoming.documentRevision??0)<(old.documentRevision??0))return retainRuntime(incoming,old);
  this.cards.set(incoming.id,incoming);return incoming;
 }
}
/** Access scopes may expose different containers; never restore a previous scope's data. */
export function currentInventory<T extends {publicId:string;revision:number;access?:string}>(previous:T|undefined,incoming:T|undefined):T|undefined {
 return previous&&incoming&&previous.publicId===incoming.publicId&&previous.access===incoming.access&&previous.revision>incoming.revision?previous:incoming;
}
