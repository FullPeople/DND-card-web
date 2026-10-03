import {irMechanics} from './ir';
import type {Character} from '../model';
import {specialSpellResource} from '../spellResourceKeys';
import {setResource} from '../resources';
import {sourceSpellEnabled,rememberSourceSpellUses} from './sourceSpellState';
import {automationEnabled} from './state';
import {bookRitualGroups,bookRitualPaymentId,BOOK_RITUAL_TIME} from '../bookRituals';

export interface SpellPayment {id:string;label:string;level:number;resourceId?:string;cost:number;available:boolean;reason?:string}
export interface SpellActionRequest {id:string;sequence:number;revision:number;selectionId:string;mode:'cast'|'restore';paymentId:string;rest?:'short'|'long'}
export interface SpellActionReceipt {id:string;sequence:number;fingerprint:string;selectionId:string;mode:'cast'|'restore';level:number;resourceId?:string;before?:number;after?:number;recovered?:{resourceId:string;before:number;after:number}[]}
export interface ActionState {version:number;sequence:number;last?:SpellActionReceipt}
export type SpellActionResult={status:'applied'|'duplicate';receipt:SpellActionReceipt;message:string}|{status:'rejected';message:string};

/** A read-only offer. Reading the menu never spends or creates resources. */
export function spellPayments(c:Character,id:string):{options:SpellPayment[];reason?:string}{
 const row=c.selections.find(s=>s.id===id&&s.entry.kind==='spell'),config=c.spellSettings?.special?.[id],grant=config?.sourceGrant;
 if(!row||!automationEnabled(c))return {options:[],reason:'此来源法术当前不可用。'};
 if(!grant){
  const groups=config?[]:bookRitualGroups(c).filter(group=>group.spells.some(spell=>spell.id===id));
  return {options:groups.map(group=>({id:bookRitualPaymentId(group.owner.id),label:`书内仪式施法（${group.owner.entry.name}；${BOOK_RITUAL_TIME}）`,level:(irMechanics(row.entry)?.spellModel?.level??-1),cost:0,available:true})),...(!groups.length?{reason:'此法术没有已核实的书内仪式资格；普通施法仍须按预备与法术位规则处理。'}:{})};
 }
 if(!sourceSpellEnabled(c,id))return {options:[],reason:'此来源法术当前不可用。'};
 if(!irMechanics(row.entry)?.spellModel)return {options:[],reason:'此法术的 IR 环阶尚未审阅，不能自动付款。'};
 const base=(irMechanics(row.entry)?.spellModel?.level??-1),level=grant.castLevel??base;
 if(!Number.isInteger(base)||base<0||base>9||level<base)return {options:[],reason:'法术环阶未支持，请人工核对。'};
 const options:SpellPayment[]=[];
 if(config.mode==='uses'){
  const resourceId=specialSpellResource(id,c),r=c.runtime.resources[resourceId],available=!!r&&Number.isSafeInteger(r.current)&&r.current>=1;
  options.push({id:'source',label:`${grant.resourceKey?'共享':'来源'}次数（${r?.current??0} / ${r?.max??config.max}）`,level,resourceId,cost:1,available,...(!available?{reason:'来源次数不足或计数器不可用。'}:{})});
 }else if(grant.usage==='free'||grant.usage==='ritual')options.push({id:grant.usage,label:grant.usage==='ritual'?'仪式施法（不消耗法术位）':'免费施法',level,cost:0,available:true});
 if(base>0&&(grant.usage==='slot'||grant.canUseSlots)){
  for(const [resourceId,r] of Object.entries(c.runtime.resources)){
   const match=/^(spell-slot|pact-slot):([1-9])$/.exec(resourceId);if(!match||Number(match[2])<level||!Number.isSafeInteger(r.max)||r.max<1)continue;
   const available=Number.isSafeInteger(r.current)&&r.current>0;
   options.push({id:`slot:${resourceId}`,label:`${match[2]}环${match[1]==='pact-slot'?'契约':'法术'}位（${r.current} / ${r.max}）`,level:Number(match[2]),resourceId,cost:1,available,...(!available?{reason:'所选法术位不足。'}:{})});
  }
 }
 return {options,...(!options.length?{reason:grant.usage==='check'?'此来源的施法消耗未声明，请按原文人工处理。':'没有符合环阶的可用施法方式。'}:{})};
}

export interface SourceSpellRestPlan {resources:{resourceId:string;before:number;after:number}[];reason?:string}
/** Rest is explicit; disabled sources, manual pools, slots and unrelated counters are excluded. */
export function sourceSpellRestPlan(c:Character,kind:'short'|'long'):SourceSpellRestPlan{
 if(!automationEnabled(c))return {resources:[],reason:'请先开启此角色卡的自动计算。'};
 if(!['short','long'].includes(kind))return {resources:[],reason:'休息类型无效。'};
 const resources:SourceSpellRestPlan['resources']=[],seen=new Set<string>();
 for(const [id,config] of Object.entries(c.spellSettings?.special||{})){
  if(!config.sourceGrant||config.mode!=='uses'||!sourceSpellEnabled(c,id)||!(config.recovery==='short'||kind==='long'&&config.recovery==='long'))continue;
  const resourceId=specialSpellResource(id,c);if(seen.has(resourceId))continue;seen.add(resourceId);
  const r=c.runtime.resources[resourceId];
  if(!r||r.unlimited||!Number.isSafeInteger(r.max)||r.max<1||!Number.isSafeInteger(r.current)||r.current<0||r.current>r.max)return {resources:[],reason:'来源次数记录无效，整批未恢复。'};
  if(r.current<r.max)resources.push({resourceId,before:r.current,after:r.max});
 }
 return {resources};
}
export function sourceSpellRestRequest(c:Character,kind:'short'|'long',id:string):SpellActionRequest{
 return {...spellActionRequest(c,'',`rest:${kind}`,id,'restore'),rest:kind};
}

/** Request identity is supplied by the application, keeping the core independent of randomness. */
export function spellActionRequest(c:Character,selectionId:string,paymentId:string,id:string,mode:'cast'|'restore'='cast'):SpellActionRequest{
 return {id,selectionId,paymentId,mode,revision:c.revision,sequence:c.runtime.automationActions?.sequence??0};
}

/** One draft transaction. The caller saves this together with the card and its undo snapshot.
 * Original requests carry their sequence: replays cannot spend again after newer operations.
 * This local contract does not claim multiplayer/server delivery guarantees. */
export function performSpellAction(c:Character,request:SpellActionRequest):SpellActionResult{
 const reject=(message:string):SpellActionResult=>({status:'rejected',message});
 if(!automationEnabled(c))return reject('请先开启此角色卡的自动计算。');
 if(typeof request.id!=='string'||!request.id.trim()||request.id.length>128||!Number.isSafeInteger(request.sequence)||request.sequence<0||!Number.isSafeInteger(request.revision)||!['cast','restore'].includes(request.mode))return reject('施法操作格式无效。');
 const state=c.runtime.automationActions;
 if(state&&state.version!==1)return reject('此卡的动作记录版本尚未支持。');
 const fingerprint=JSON.stringify([request.revision,request.selectionId,request.mode,request.paymentId,...(request.rest!==undefined?[request.rest]:[])]);
 if(state?.last?.id===request.id){
  if(state.last.sequence===request.sequence&&state.last.fingerprint===fingerprint)return {status:'duplicate',receipt:state.last,message:'该操作已经记录，未重复扣费。'};
  return reject('操作编号已被用于其他请求，请重新操作。');
 }
 const sequence=state?.sequence??0;
 if(request.sequence!==sequence||request.revision!==c.revision)return reject('角色已发生变化，请按当前次数重新操作。');
 if(sequence>=Number.MAX_SAFE_INTEGER)return reject('动作序号已达到上限，需要迁移记录。');
 if(request.rest!==undefined){
  if(!['short','long'].includes(request.rest)||request.mode!=='restore'||request.selectionId!==''||request.paymentId!==`rest:${request.rest}`)return reject('休息操作格式无效。');
  const plan=sourceSpellRestPlan(c,request.rest);if(plan.reason)return reject(plan.reason);if(!plan.resources.length)return reject('没有需要恢复的启用来源次数。');
  const receipt:SpellActionReceipt={id:request.id,sequence,fingerprint,selectionId:'',mode:'restore',level:0,recovered:plan.resources};
  for(const row of plan.resources)setResource(c,row.resourceId,row.after);
  c.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};rememberSourceSpellUses(c);
  return {status:'applied',receipt,message:`已按${request.rest==='short'?'短':'长'}休恢复 ${plan.resources.length} 项来源次数。`};
 }
 const config=c.spellSettings?.special?.[request.selectionId];
 if(config?.sourceGrant&&!sourceSpellEnabled(c,request.selectionId))return reject('此来源法术当前不可用。');
 let payment:SpellPayment|undefined;
 if(request.mode==='restore'){
  if(!config?.sourceGrant||config.mode!=='uses'||request.paymentId!=='source')return reject('这个法术没有可恢复的来源次数。');
  const resourceId=specialSpellResource(request.selectionId,c),r=c.runtime.resources[resourceId];
  if(!r||!Number.isSafeInteger(r.max)||r.max<1||!Number.isSafeInteger(r.current))return reject('次数记录无效，未恢复。');
  if(r.current>=r.max)return reject('次数已经充足。');
  payment={id:'source',label:'恢复来源次数',level:config.sourceGrant.castLevel??(irMechanics(c.selections.find(s=>s.id===request.selectionId)!.entry)?.spellModel?.level??-1),resourceId,cost:r.current-r.max,available:true};
 }else{
  const offer=spellPayments(c,request.selectionId);payment=offer.options.find(p=>p.id===request.paymentId);
  if(!payment)return reject(offer.reason||'此来源不允许所选的施法方式。');
  if(!payment.available)return reject(payment.reason||'所需资源不足。');
 }
 const resource=payment.resourceId?c.runtime.resources[payment.resourceId]:undefined,before=resource?.current,after=before===undefined?undefined:before-payment.cost;
 // All validation precedes mutation, including restored counter bounds.
 if(after!==undefined&&(!Number.isSafeInteger(after)||after<0||after>resource!.max))return reject('资源状态已变化，未执行。');
 const receipt:SpellActionReceipt={id:request.id,sequence,fingerprint,selectionId:request.selectionId,mode:request.mode,level:payment.level,...(payment.resourceId?{resourceId:payment.resourceId,before,after}:{})};
 if(payment.resourceId&&after!==undefined)setResource(c,payment.resourceId,after);
 c.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};if(config?.sourceGrant)rememberSourceSpellUses(c);
 return {status:'applied',receipt,message:payment.id.startsWith('book-ritual:')?`已记录仪式施法。${BOOK_RITUAL_TIME}`:request.mode==='restore'?'已恢复来源次数。':payment.resourceId?`已记录 ${payment.level} 环施法，${payment.label.split('（')[0]}剩余 ${after}。`:'已记录施法，不消耗资源。'};
}

export function validateActionState(value:unknown):void{
 if(value===undefined)return;
 const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(value)||!Number.isSafeInteger(value.version)||value.version<1)throw Error('自动化动作记录无效。');
 if(value.version!==1)return; // Preserve unfamiliar ledgers, never execute them.
 if(!Number.isSafeInteger(value.sequence)||value.sequence<0)throw Error('自动化动作序号无效。');
 if(value.last!==undefined){const r=value.last;if(!object(r)||typeof r.id!=='string'||!r.id.trim()||r.id.length>128||!Number.isSafeInteger(r.sequence)||r.sequence!==value.sequence-1||typeof r.fingerprint!=='string'||r.fingerprint.length>40000||typeof r.selectionId!=='string'||!['cast','restore'].includes(r.mode)||!Number.isInteger(r.level)||r.level<0||r.level>9||r.resourceId!==undefined&&(typeof r.resourceId!=='string'||!Number.isSafeInteger(r.before)||r.before<0||!Number.isSafeInteger(r.after)||r.after<0))throw Error('自动化动作回执无效。');if(r.recovered!==undefined&&(!Array.isArray(r.recovered)||r.recovered.length>3000||r.recovered.some((x:any)=>!object(x)||typeof x.resourceId!=='string'||!Number.isSafeInteger(x.before)||x.before<0||!Number.isSafeInteger(x.after)||x.after<x.before)))throw Error('批量恢复回执无效。');}
}
