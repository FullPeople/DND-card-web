import {limitedSourceSpellOffer,limitedSourceSpellBasis,spendLimitedSourceSpell,ownedLimitedSourceResource} from './limitedSourceUses';
import {ordinarySpellOffer,ordinarySpellActionBasis,ordinaryCastingClassContextMalformed} from './ordinarySpellCasting';
import {spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
export type {SpellActionAuthority} from './spellActionAuthority';
import type {Character} from '../model';
import {specialSpellResource} from '../spellResourceKeys';
import {setResource} from '../resources';
import {sourceSpellEnabled,rememberSourceSpellUses} from './sourceSpellState';
import {automationEnabled} from './state';
import {bookRitualGroups,bookRitualPaymentId,BOOK_RITUAL_TIME} from '../bookRituals';
import {planSourceSpells} from './sourceSpellPlan';
import {learnedInvocationRule,invocationSpellMatches,invocationPactSlot} from './invocations';

export interface SpellPayment {id:string;label:string;level:number;resourceId?:string;cost:number;available:boolean;reason?:string;debits?:{resourceId:string;cost:number}[]}
export interface SpellActionRequest {id:string;sequence:number;revision:number;selectionId:string;mode:'cast'|'restore';paymentId:string;rest?:'short'|'long';basis?:string;casterId?:string;limitedIntent?:{confirmedLimitedSourceValid:true}}
export interface SpellActionReceipt {id:string;sequence:number;fingerprint:string;selectionId:string;mode:'cast'|'restore';level:number;resourceId?:string;before?:number;after?:number;recovered?:{resourceId:string;before:number;after:number}[];spent?:{resourceId:string;before:number;after:number}[]}
export interface ActionState {version:number;sequence:number;last?:SpellActionReceipt}
export type SpellActionResult={status:'applied'|'duplicate';receipt:SpellActionReceipt;message:string}|{status:'rejected';message:string};

function currentSourceSpell(c:Character,id:string){
 const row=c.selections.find(row=>row.id===id&&row.entry.kind==='spell'),saved=c.spellSettings?.special?.[id],cached=saved?.sourceGrant;
 if(!row||!cached||!sourceSpellEnabled(c,id))return;
 const current=planSourceSpells(c).grants.find(candidate=>candidate.id===id),grant=current?.config.sourceGrant;
 if(!grant?.active||grant.ownerId!==cached.ownerId||grant.key!==cached.key||grant.usage!==cached.usage||grant.resourceKey!==cached.resourceKey||grant.resourceCost!==cached.resourceCost||grant.resourceName!==cached.resourceName)return;
 const invocation=learnedInvocationRule(c,current!.owner);
 if(invocation?.mechanism==='spell'&&(row.parentId!==current!.owner.id||row.grantKey!==current!.key||row.entry.id!==current!.entry.id||!invocationSpellMatches(row.entry,invocation)))return;
 if(grant.usage==='invocation-pact'&&(grant.usageKey!==cached.usageKey||grant.canUseSlots!==cached.canUseSlots||grant.castLevel!==cached.castLevel||saved!.mode!==current!.config.mode||saved!.max!==current!.config.max||saved!.recovery!==current!.config.recovery||!invocationPactSlot(c,current!.owner)))return;
 return {current:current!,grant,config:current!.config,invocation};
}
const validCounter=(r:Character['runtime']['resources'][string]|undefined,max?:number)=>!!r&&!r.unlimited&&Number.isSafeInteger(r.max)&&r.max>=1&&(max===undefined||r.max===max)&&Number.isSafeInteger(r.current)&&r.current>=0&&r.current<=r.max;
function invocationUseCounter(c:Character,id:string,grant:NonNullable<ReturnType<typeof currentSourceSpell>>['grant']){
 const resourceId=specialSpellResource(id,c),r=c.runtime.resources[resourceId];
 return validCounter(r,1)&&r.sourceSpellGrant?.usageKey===grant.usageKey?{resourceId,r}:undefined;
}

/** A read-only offer. Reading the menu never spends or creates resources. */
function sourceSpellPayments(c:Character,id:string,authority?:SpellActionAuthority):{options:SpellPayment[];reason?:string}{
 const row=c.selections.find(s=>s.id===id&&s.entry.kind==='spell');let config=c.spellSettings?.special?.[id],grant=config?.sourceGrant;
 if(!row||!automationEnabled(c))return {options:[],reason:'此来源法术当前不可用。'};
 if(!grant){
  const groups=config?[]:bookRitualGroups(c).filter(group=>group.spells.some(spell=>spell.id===id));
  return {options:groups.map(group=>({id:bookRitualPaymentId(group.owner.id),label:`书内仪式施法（${group.owner.entry.name}；${BOOK_RITUAL_TIME}）`,level:Number(row.entry.raw.level),cost:0,available:true})),...(!groups.length?{reason:'此法术没有已核实的书内仪式资格；普通施法仍须按预备与法术位规则处理。'}:{})};
 }
 if(!sourceSpellEnabled(c,id))return {options:[],reason:'此来源法术当前不可用。'};
 const verified=currentSourceSpell(c,id);
 if(!verified)return {options:[],reason:'来源声明、身份或授予归属已变化，请同步当前卡后再施法。'};
 const {current,invocation}=verified;config=verified.config;grant=verified.grant;
 if(grant.usage==='limited'){const finite=limitedSourceSpellOffer(c,id,authority);return {options:finite?[finite.payment]:[],...(!finite?{reason:'有限来源历史、归属或计数镜像当前不可用；未改用其他支付。'}:{})};}
 const base=Number(row.entry.raw.level),level=grant.castLevel??base;
 if(!Number.isInteger(base)||base<0||base>9||level<base)return {options:[],reason:'法术环阶未支持，请人工核对。'};
 const options:SpellPayment[]=[];
 if(grant.usage==='invocation-pact'){
  const pool=invocationUseCounter(c,id,grant),slot=invocationPactSlot(c,current.owner);
  if(!pool)return {options:[],reason:'本祈唤次数记录无效或不是此授予拥有的次数；未接管手工记录。'};
  if(!slot)return {options:[],reason:'当前没有唯一、已核实的本职业契约魔法来源；不会改用普通法术位或其他职业资源。'};
  const r=c.runtime.resources[slot.resourceId],valid=validCounter(r,slot.max)&&r.automatic===true&&!r.featureGrant&&!r.sourceSpellGrant;
  const available=pool.r.current>=1&&valid&&r.current>=1;
  const reason=pool.r.current<1?'本祈唤长休次数不足。':!valid?'当前魔契师契约位记录缺失或无效。':r.current<1?'当前魔契师契约位不足。':undefined;
  options.push({id:'invocation-pact',label:`祈唤次数（${pool.r.current} / 1）＋${slot.level}环契约位（${r?.current??0} / ${r?.max??slot.max}），各消耗 1`,level:slot.level,cost:0,debits:[{resourceId:pool.resourceId,cost:1},{resourceId:slot.resourceId,cost:1}],available,...(reason?{reason}:{})});
 }else if(grant.usage==='resource'){
  const resourceId=grant.resourceKey!,r=c.runtime.resources[resourceId],cost=grant.resourceCost!,available=!!r&&!r.unlimited&&Number.isSafeInteger(r.max)&&r.max>=0&&Number.isSafeInteger(r.current)&&r.current<=r.max&&r.current>=cost;
  options.push({id:'resource',label:`${grant.resourceName}（消耗 ${cost}；${r?.current??0} / ${r?.max??0}）`,level,resourceId,cost,available,...(!available?{reason:'来源资源不足或计数器不可用。'}:{})});
 }else if(config.mode==='uses'){
  const resourceId=specialSpellResource(id,c),r=c.runtime.resources[resourceId],available=!!r&&Number.isSafeInteger(r.current)&&r.current>=1;
  options.push({id:'source',label:`${grant.resourceKey?'共享':'来源'}次数（${r?.current??0} / ${r?.max??config.max}）`,level,resourceId,cost:1,available,...(!available?{reason:'来源次数不足或计数器不可用。'}:{})});
 }else if(grant.usage==='free'||grant.usage==='ritual')options.push({id:grant.usage,label:grant.usage==='ritual'?'仪式施法（不消耗法术位）':invocation?.selfOnly?'免费施法（仅自身）':'免费施法',level,cost:0,available:true});
 if(base>0&&(grant.usage==='slot'||grant.canUseSlots)){
  for(const [resourceId,r] of Object.entries(c.runtime.resources)){
   const match=/^(spell-slot|pact-slot):([1-9])$/.exec(resourceId);if(!match||Number(match[2])<level||!Number.isSafeInteger(r.max)||r.max<1)continue;
   const available=Number.isSafeInteger(r.current)&&r.current>0;
   options.push({id:`slot:${resourceId}`,label:`${match[2]}环${match[1]==='pact-slot'?'契约':'法术'}位（${r.current} / ${r.max}）`,level:Number(match[2]),resourceId,cost:1,available,...(!available?{reason:'所选法术位不足。'}:{})});
  }
 }
 return {options,...(!options.length?{reason:grant.usage==='check'?'此来源的施法消耗未声明，请按原文人工处理。':'没有符合环阶的可用施法方式。'}:{})};
}

/** The UI exposes this single-counter confirmation only for the seven reviewed
 * invocations. It is not a complete long-rest operation or a slot refill. */
export function spellPayments(c:Character,id:string,authority?:SpellActionAuthority,casterId?:string){
 const ordinary=ordinarySpellOffer(c,id,casterId,authority),source=!c.spellSettings?.special?.[id]?.sourceGrant&&ordinaryCastingClassContextMalformed(c)?{options:[],reason:'已识别的职业快照已修改，未调用旧施法解码或仪式回退。'}:sourceSpellPayments(c,id,authority);
 const options=[...ordinary.options,...source.options].map(option=>{const reason=spellActionAuthorityReason(c,authority,[...(option.resourceId?[option.resourceId]:[]),...(option.debits?.map(d=>d.resourceId)||[])]);return reason?{...option,available:false,reason}:option;});
 return {...ordinary,options,ordinaryReason:ordinary.reason,reason:ordinary.casters.length?ordinary.reason:source.reason||ordinary.reason};
}
export function sourceSpellRestoreOffer(c:Character,id:string,authority?:SpellActionAuthority):{paymentId:'source';label:string;available:boolean;reason?:string}|undefined{
 const verified=currentSourceSpell(c,id);if(verified?.grant.usage!=='invocation-pact')return;
 const pool=invocationUseCounter(c,id,verified.grant),denied=spellActionAuthorityReason(c,authority,pool?[pool.resourceId]:[]),available=!denied&&!!pool&&pool.r.current<1;
 return {paymentId:'source',label:'确认已长休恢复本祈唤次数',available,...(!available?{reason:denied||(pool?'本祈唤次数已经充足。':'本祈唤次数记录无效。')}:{})};
}
function invocationActionBasis(c:Character,id:string):string{
 const row=c.selections.find(row=>row.id===id),verified=currentSourceSpell(c,id),chain=[];
 let node=row;const seen=new Set<string>();
 while(node&&!seen.has(node.id)){seen.add(node.id);chain.push([node.id,node.entry.id,node.entry.revision,node.level,node.parentId,node.grantKey]);node=c.selections.find(parent=>parent.id===node?.parentId);}
 const payments=spellPayments(c,id).options,ids=payments.flatMap(option=>option.debits?.map(debit=>debit.resourceId)||[]);
 return JSON.stringify([chain,verified?.config,ids.map(key=>[key,c.runtime.resources[key]]),payments]);
}

export interface SourceSpellRestPlan {resources:{resourceId:string;before:number;after:number}[];reason?:string}
/** Rest is explicit; disabled sources, manual pools, slots and unrelated counters are excluded. */
export function sourceSpellRestPlan(c:Character,kind:'short'|'long',authority?:SpellActionAuthority):SourceSpellRestPlan{
 if(!automationEnabled(c))return {resources:[],reason:'请先开启此角色卡的自动计算。'};
 if(!['short','long'].includes(kind))return {resources:[],reason:'休息类型无效。'};
 const denied=spellActionAuthorityReason(c,authority);if(denied)return {resources:[],reason:denied};
 const resources:SourceSpellRestPlan['resources']=[],seen=new Set<string>();
 for(const [id,config] of Object.entries(c.spellSettings?.special||{})){
  if(!config.sourceGrant||config.mode!=='uses'||!sourceSpellEnabled(c,id)||!(config.recovery==='short'||kind==='long'&&config.recovery==='long'))continue;
  const verified=currentSourceSpell(c,id);if(!verified)return {resources:[],reason:'来源声明或授予归属已变化，整批未恢复。'};
  if(verified.grant.usage==='invocation-pact'&&(!invocationUseCounter(c,id,verified.grant)||verified.config.recovery!=='long'))return {resources:[],reason:'祈唤次数记录无效，整批未恢复。'};
  if(!(verified.config.recovery==='short'||kind==='long'&&verified.config.recovery==='long'))continue;
  const resourceId=specialSpellResource(id,c);if(ownedLimitedSourceResource(c,resourceId))continue;if(seen.has(resourceId))continue;seen.add(resourceId);
  const r=c.runtime.resources[resourceId],locked=spellActionAuthorityReason(c,authority,[resourceId]);if(locked)return {resources:[],reason:locked};
  if(!r||r.unlimited||!Number.isSafeInteger(r.max)||r.max<1||!Number.isSafeInteger(r.current)||r.current<0||r.current>r.max)return {resources:[],reason:'来源次数记录无效，整批未恢复。'};
  if(r.current<r.max)resources.push({resourceId,before:r.current,after:r.max});
 }
 return {resources};
}
export function sourceSpellRestRequest(c:Character,kind:'short'|'long',id:string):SpellActionRequest{
 return {...spellActionRequest(c,'',`rest:${kind}`,id,'restore'),rest:kind};
}

/** Request identity is supplied by the application, keeping the core independent of randomness. */
export function spellActionRequest(c:Character,selectionId:string,paymentId:string,id:string,mode:'cast'|'restore'='cast',casterId?:string,limitedIntent?:{confirmedLimitedSourceValid:true}):SpellActionRequest{
 const request:SpellActionRequest={id,selectionId,paymentId,mode,revision:c.revision,sequence:c.runtime.automationActions?.sequence??0};
 if(paymentId.startsWith('ordinary:')){request.casterId=casterId||ordinarySpellOffer(c,selectionId).casterId;request.basis=ordinarySpellActionBasis(c,selectionId,request.casterId);}
 if(c.spellSettings?.special?.[selectionId]?.sourceGrant?.usage==='limited'){request.basis=limitedSourceSpellBasis(c,selectionId);request.limitedIntent=limitedIntent;}
 if(c.spellSettings?.special?.[selectionId]?.sourceGrant?.usage==='invocation-pact')request.basis=invocationActionBasis(c,selectionId);
 return request;
}

/** One draft transaction. The caller saves this together with the card and its undo snapshot.
 * Original requests carry their sequence: replays cannot spend again after newer operations.
 * This local contract does not claim multiplayer/server delivery guarantees. */
export function performSpellAction(c:Character,request:SpellActionRequest,authority?:SpellActionAuthority):SpellActionResult{
 const reject=(message:string):SpellActionResult=>({status:'rejected',message});
 const denied=spellActionAuthorityReason(c,authority);if(denied)return reject(denied);
 if(!automationEnabled(c))return reject('请先开启此角色卡的自动计算。');
 if(!request||typeof request.selectionId!=='string'||request.selectionId.length>2000||typeof request.paymentId!=='string'||!request.paymentId||request.paymentId.length>4000||typeof request.id!=='string'||!request.id.trim()||request.id.length>128||!Number.isSafeInteger(request.sequence)||request.sequence<0||!Number.isSafeInteger(request.revision)||!['cast','restore'].includes(request.mode)||request.basis!==undefined&&(typeof request.basis!=='string'||request.basis.length>30000)||request.casterId!==undefined&&(typeof request.casterId!=='string'||!request.casterId||request.casterId.length>2000))return reject('施法操作格式无效。');
 const state=c.runtime.automationActions;
 if(state&&state.version!==1)return reject('此卡的动作记录版本尚未支持。');
 const fingerprint=JSON.stringify([request.revision,request.selectionId,request.mode,request.paymentId,...(request.rest!==undefined?[request.rest]:[]),...(request.basis!==undefined?[request.basis]:[]),...(request.casterId!==undefined?[request.casterId]:[]),...(request.limitedIntent!==undefined?[request.limitedIntent]:[])]);
 if(fingerprint.length>40000)return reject('施法操作记录超出支持范围。');
 if(state?.last?.id===request.id){
  if(state.last.sequence===request.sequence&&state.last.fingerprint===fingerprint)return {status:'duplicate',receipt:state.last,message:'该操作已经记录，未重复扣费。'};
  return reject('操作编号已被用于其他请求，请重新操作。');
 }
 const sequence=state?.sequence??0;
 if(request.sequence!==sequence||request.revision!==c.revision)return reject('角色已发生变化，请按当前次数重新操作。');
 if(sequence>=Number.MAX_SAFE_INTEGER)return reject('动作序号已达到上限，需要迁移记录。');
 if(request.rest!==undefined){
  if(!['short','long'].includes(request.rest)||request.mode!=='restore'||request.selectionId!==''||request.paymentId!==`rest:${request.rest}`)return reject('休息操作格式无效。');
  const plan=sourceSpellRestPlan(c,request.rest,authority);if(plan.reason)return reject(plan.reason);if(!plan.resources.length)return reject('没有需要恢复的启用来源次数。');
  const receipt:SpellActionReceipt={id:request.id,sequence,fingerprint,selectionId:'',mode:'restore',level:0,recovered:plan.resources};
  for(const row of plan.resources)setResource(c,row.resourceId,row.after);
  c.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};rememberSourceSpellUses(c);
  return {status:'applied',receipt,message:`已按${request.rest==='short'?'短':'长'}休恢复 ${plan.resources.length} 项来源次数。`};
 }
 let config=c.spellSettings?.special?.[request.selectionId];
 if(config?.sourceGrant&&!sourceSpellEnabled(c,request.selectionId))return reject('此来源法术当前不可用。');
 if(config?.sourceGrant){const verified=currentSourceSpell(c,request.selectionId);if(!verified)return reject('来源声明、身份或授予归属已变化，未执行。');config=verified.config;if(verified.grant.usage==='invocation-pact'&&(typeof request.basis!=='string'||request.basis!==invocationActionBasis(c,request.selectionId)))return reject('祈唤来源或资源已变化，请重新操作。');}
 let payment:SpellPayment|undefined;
 if(request.mode==='restore'){
  if(!config?.sourceGrant||config.sourceGrant.usage==='limited'||config.mode!=='uses'||request.paymentId!=='source')return reject('这个法术没有可恢复的来源次数。');
  const resourceId=specialSpellResource(request.selectionId,c),r=c.runtime.resources[resourceId];
  if(!validCounter(r)||config.sourceGrant.usage==='invocation-pact'&&!invocationUseCounter(c,request.selectionId,config.sourceGrant))return reject('次数记录无效，未恢复。');
  if(r.current>=r.max)return reject('次数已经充足。');
  payment={id:'source',label:'恢复来源次数',level:config.sourceGrant.castLevel??Number(c.selections.find(s=>s.id===request.selectionId)!.entry.raw.level),resourceId,cost:r.current-r.max,available:true};
 }else{
  if(request.paymentId.startsWith('ordinary:')&&(request.mode!=='cast'||!request.casterId||request.basis!==ordinarySpellActionBasis(c,request.selectionId,request.casterId)))return reject('职业、学习归属或法术位状态已变化，请重新确认本次施法。');
  const offer=spellPayments(c,request.selectionId,authority,request.casterId);payment=offer.options.find(p=>p.id===request.paymentId);
  if(!payment)return reject(offer.reason||'此来源不允许所选的施法方式。');
  if(!payment.available)return reject(payment.reason||'所需资源不足。');
 }
 const locked=spellActionAuthorityReason(c,authority,[...(payment.resourceId?[payment.resourceId]:[]),...(payment.debits?.map(d=>d.resourceId)||[])]);if(locked)return reject(locked);
 if(payment.id==='limited'){
  if(request.mode!=='cast'||!request.limitedIntent||Array.isArray(request.limitedIntent)||Object.keys(request.limitedIntent).length!==1||!Object.hasOwn(request.limitedIntent,'confirmedLimitedSourceValid')||request.limitedIntent.confirmedLimitedSourceValid!==true||typeof request.basis!=='string')return reject('请重新确认本次有限来源仍有效。');
  const spent=spendLimitedSourceSpell(c,request.selectionId,request.id,request.basis,true,authority);if(!spent)return reject('有限来源、历史或余额已变化，未执行。');
  const receipt:SpellActionReceipt={id:request.id,sequence,fingerprint,selectionId:request.selectionId,mode:'cast',level:payment.level,resourceId:spent.key,before:spent.before,after:spent.after};c.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};return {status:'applied',receipt,message:'已扣除1次有限来源次数；不会按休息或刷新恢复。'};
 }
 if(payment.debits){
  if(request.mode!=='cast'||payment.debits.length!==2||new Set(payment.debits.map(row=>row.resourceId)).size!==2)return reject('双资源支付声明无效，未执行。');
  const spent:NonNullable<SpellActionReceipt['spent']>=[];
  for(const debit of payment.debits){const r=c.runtime.resources[debit.resourceId];if(!validCounter(r)||debit.cost!==1||r.current<debit.cost)return reject('所需资源状态已变化，整笔未执行。');spent.push({resourceId:debit.resourceId,before:r.current,after:r.current-debit.cost});}
  const receipt:SpellActionReceipt={id:request.id,sequence,fingerprint,selectionId:request.selectionId,mode:'cast',level:payment.level,spent};
  for(const row of spent)setResource(c,row.resourceId,row.after);
  c.runtime.automationActions={version:1,sequence:sequence+1,last:receipt};rememberSourceSpellUses(c);
  return {status:'applied',receipt,message:`已记录 ${payment.level} 环施法，祈唤次数与魔契师契约位各消耗 1。`};
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
 if(value.last!==undefined){const r=value.last;if(!object(r)||typeof r.id!=='string'||!r.id.trim()||r.id.length>128||!Number.isSafeInteger(r.sequence)||r.sequence!==value.sequence-1||typeof r.fingerprint!=='string'||r.fingerprint.length>40000||typeof r.selectionId!=='string'||!['cast','restore'].includes(r.mode)||!Number.isInteger(r.level)||r.level<0||r.level>9||r.resourceId!==undefined&&(typeof r.resourceId!=='string'||!Number.isSafeInteger(r.before)||r.before<0||!Number.isSafeInteger(r.after)||r.after<0))throw Error('自动化动作回执无效。');if(r.spent!==undefined&&(r.mode!=='cast'||r.resourceId!==undefined||r.before!==undefined||r.after!==undefined||r.recovered!==undefined||!Array.isArray(r.spent)||r.spent.length!==2||new Set(r.spent.map((x:any)=>x?.resourceId)).size!==2||r.spent.some((x:any)=>!object(x)||typeof x.resourceId!=='string'||!x.resourceId||x.resourceId.length>40000||!Number.isSafeInteger(x.before)||x.before<1||!Number.isSafeInteger(x.after)||x.after!==x.before-1)))throw Error('双资源支出回执无效。');if(r.recovered!==undefined&&(!Array.isArray(r.recovered)||r.recovered.length>3000||r.recovered.some((x:any)=>!object(x)||typeof x.resourceId!=='string'||!Number.isSafeInteger(x.before)||x.before<0||!Number.isSafeInteger(x.after)||x.after<x.before)))throw Error('批量恢复回执无效。');}
}
