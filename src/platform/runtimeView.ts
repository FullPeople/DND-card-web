import type {Character,Derived,Entry} from '../core/model';
import {runtimeFrom} from '../core/workbenchRuntime';
import type {CacheAccess} from './workbench-cache';

export type RuntimeView={version:1;observation:number;documentRevision:number;tokenRevision:number;tokenId:string;pending:boolean;stats:Record<string,number>;resources:any[];conditions:{id:string;name:string;entry?:Entry;level?:number}[]};
const revision=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
function parse(value:any):RuntimeView|undefined {
 if(!value||value.version!==1||!revision(value.observation)||!revision(value.documentRevision)||!revision(value.tokenRevision)||typeof value.tokenId!=='string'||typeof value.pending!=='boolean'||!value.stats||typeof value.stats!=='object'||Array.isArray(value.stats)||!Array.isArray(value.resources)||!Array.isArray(value.conditions))return;
 if(Object.values(value.stats).some(n=>typeof n!=='number'||!Number.isFinite(n))||value.resources.some((r:any)=>!r||typeof r.id!=='string'||!r.id||!Number.isFinite(r.current)||!Number.isFinite(r.max))||value.conditions.some((r:any)=>!r||typeof r.id!=='string'||!r.id||typeof r.name!=='string'))return;
 const normalized=runtimeFrom(value);
 return {...value,stats:normalized.stats,resources:normalized.resources,conditions:normalized.conditions};
}

/** Private host observations are a display layer, never a document receipt. */
export class RuntimeViews {
 private access?:CacheAccess;
 private views=new Map<string,{cardId:string;view:RuntimeView}>();
 private projected=new WeakMap<object,{view:RuntimeView|undefined;result:any}>();
 version=0;
 reset(){this.access=undefined;this.views.clear();this.projected=new WeakMap();this.version++;}
 restrict(access:CacheAccess){
  if(this.access&&(this.access.room!==access.room||this.access.scope!==access.scope||this.access.role!==access.role))this.reset();
  for(const [key,row] of this.views){
   const before=this.access?.cards.find(card=>card.id===row.cardId),next=access.cards.find(card=>card.id===row.cardId);
   if(access.enabled.characterCards===false||!next||before?.grantVersion!==next.grantVersion||!this.permits(next,row.view.tokenId)){this.views.delete(key);this.version++;}
  }
  this.access=access;
 }
 private permits(grant:CacheAccess['cards'][number],tokenId:string){return !tokenId||!grant.itemIds||grant.itemIds.includes(tokenId);}
 remember(value:any){
  const cardId=value.cardId||value.id,view=parse(value.runtimeView),grant=this.access?.cards.find(card=>card.id===cardId);
  if(!view||!grant||this.access?.enabled.characterCards===false||!this.permits(grant,view.tokenId)||view.tokenId&&view.tokenId!==value.itemId)return;
  const key=JSON.stringify([cardId,view.tokenId]),old=this.views.get(key)?.view;
  if(old&&(view.documentRevision<old.documentRevision||Math.max(view.documentRevision,view.tokenRevision)<Math.max(old.documentRevision,old.tokenRevision)||view.observation<old.observation&&view.documentRevision<=old.documentRevision&&view.tokenRevision<=old.tokenRevision))return;
  if(old&&JSON.stringify(old)===JSON.stringify(view))return;
  this.views.delete(key);this.views.set(key,{cardId,view});
  while(this.views.size>128)this.views.delete(this.views.keys().next().value!);
  this.version++;
 }
 project<T extends Record<string,any>>(value:T,bodyRevision=0,enabled=true):T {
  const cardId=value.cardId||value.id,tokenId=value.itemId===`card:${cardId}`?'':value.itemId;
  const candidate=enabled?this.views.get(JSON.stringify([cardId,tokenId]))?.view:undefined;
  const floor=Math.max(bodyRevision,value.documentRevision||0),view=candidate&&Math.max(candidate.documentRevision,candidate.tokenRevision)>=floor?candidate:undefined;
  const cached=this.projected.get(value);if(cached&&cached.view===view)return cached.result;
  const {runtimeView:_ignored,...canonical}=value;
  const result=view?{...canonical,stats:{...value.stats,...view.stats},resources:view.resources,conditions:view.conditions,runtimeView:view}:_ignored!==undefined?canonical:value;
  this.projected.set(value,{view,result});return result as T;
 }
}

/** Mutates only App's detached view. Saving still compares genuine user edits
 * against the untouched observed document; receiving this view sends no write. */
export function applyCharacterRuntimeView(character:Character,view:RuntimeView,document:any){
 if(typeof view.stats.health==='number')character.runtime.hp=view.stats.health;
 if(typeof view.stats['temporary health']==='number')character.runtime.tempHp=view.stats['temporary health'];
 const max=view.stats['max health'];
 if(typeof max==='number'&&max!==document?.core_stats?.hp?.max){
  character.baseHp=max;character.sheetBonuses={...character.sheetBonuses,hp:0};
  character.adjustments=[...(character.adjustments||[]).filter(row=>row.target!=='hp'),{id:'suite-hp',target:'hp',value:max,reason:'枭熊场景'}];
 }
 const savedResources=document?.dnd_card_web?.runtime?.resources||document?.web_resources||{};
 const canonicalRows=Object.entries(savedResources).map(([id,row]:[string,any])=>({...row,id}));
 // Leave normal document hydration alone when only HP changed. An explicit
 // resource removal also removes its manual slot mirror, so the next edit
 // cannot recreate the removed resource from an older settings row.
 if(JSON.stringify(canonicalRows)!==JSON.stringify(view.resources)){
  character.runtime.resources=Object.fromEntries(view.resources.map(row=>[row.id,structuredClone(row)]));
  if(character.spellSettings)character.spellSettings.slots=Object.fromEntries(view.resources.filter(row=>/^spell-slot:[1-9]$/.test(row.id)).map(row=>[row.id.split(':')[1],{max:row.max,used:row.max-row.current}]));
 }
 const saved=character.selections.filter(row=>row.entry.kind==='condition');
 character.selections=character.selections.filter(row=>row.entry.kind!=='condition');
 for(const condition of view.conditions){
  const old=saved.find(row=>row.entry.raw._suiteStatusId===condition.id||condition.id===`web:${row.entry.id}`||condition.entry?.id===row.entry.id);
  const entry=condition.entry||old?.entry||{id:'suite-condition:'+condition.id,kind:'condition',name:condition.name,english:condition.name,source:'IMPORTED',edition:'both',packId:'imported',revision:'1',entries:[],raw:{}} as Entry;
  character.selections.push({...old,id:old?.id||'suite-status:'+condition.id,entry:{...entry,raw:{...entry.raw,_suiteStatusId:condition.id}},level:condition.level??old?.level??1,quantity:old?.quantity??1,equipped:old?.equipped??false});
 }
}

/** A newer committed projection can precede the private body which explains
 * its derived AC. Display it without writing a final-value character override. */
export function displayRuntimeDerived(derived:Derived,view:RuntimeView|undefined,bodyRevision:number):Derived {
 const ac=view?.stats['armor class'];
 return view&&view.tokenRevision>bodyRevision&&typeof ac==='number'&&Number.isFinite(ac)&&ac!==derived.ac
  ?{...derived,ac,trace:{...derived.trace,ac:[`枭熊已确认护甲 ${ac}；正在更新完整角色资料`]}}:derived;
}
