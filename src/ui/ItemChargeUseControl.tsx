import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {itemChargeBoundReceipt,itemChargeKnownStateVersion,itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../core/automation/itemChargeDebits';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

const CONTEXT_LABELS:Record<string,string>={
 'accounting-only':'仅记录本次来源费用，不执行物品效果',
 'current-item-held':'本次当前持用此物品',
 'current-item-worn':'本次当前穿戴此物品',
 'this-item-melee-hit':'本次此物品的近战攻击已命中',
 'this-weapon-dealt-damage':'本次此武器已造成伤害',
 'attack-hit':'本次攻击已命中',
 'current-source-stage':'已核对此物品当前来源阶段',
 'action-used':'本次已使用动作',
 'magic-action-used':'本次已使用魔法动作',
 'bonus-action-used':'本次已使用附赠动作',
 'reaction-used':'本次已使用反应',
 'affected-by-spell':'本次已受到所需法术影响',
 'source-command-spoken':'本次已说出来源命令',
 'source-gesture-performed':'本次已完成来源手势',
 'visible-creature-within-60-feet':'本次目标为60英尺内可见生物',
 'visible-creature-within-5-feet':'本次目标为5英尺内可见生物',
 'visible-unworn-uncarried-object-within-60-feet':'本次目标为60英尺内可见且未被穿戴或携带的物件',
 'nonmagical-object':'本次目标为非魔法物件',
 'visible-large-or-smaller-creature-within-60-feet':'本次目标为60英尺内可见的大型或更小生物'
};

/** A source-proved fixed-cost bookkeeping route, not item effect execution. */
export function ItemChargeUseControl({c,ownerId,edit,writable=true}:{c:Character;ownerId:string;edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus();
 const matches=itemChargeOffers(c,feedback.authority).filter(row=>row.ownerId===ownerId),offer=matches.length===1?matches[0]:undefined;
 const [remaining,setRemaining]=useState(''),[genuine,setGenuine]=useState(false),[known,setKnown]=useState(false),[action,setAction]=useState<{id:string;scope:string;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const [branchKey,setBranchKey]=useState(''),[costChoice,setCostChoice]=useState(''),[context,setContext]=useState<Record<string,boolean>>({});
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,writable,active});live.current={c,ownerId,writable,active};
 const clearDraft=()=>{setRemaining('');setGenuine(false);setKnown(false);setBranchKey('');setCostChoice('');setContext({});};
 useLayoutEffect(()=>{epoch.current++;clearDraft();},[c.id,ownerId,offer?.basis,writable,active,feedback.authority.canEdit,feedback.authority.gm]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId]);
 const last=c.runtime.itemChargeDebits?.last,legacyReceipt=c.runtime.itemChargeDebits?.version===1&&offer?.record?.ownerId===ownerId&&last&&last.key===offer.key&&offer.record.events.some(event=>event.id===last.id&&event.sequence===last.sequence)?last:undefined;
 const receipt=c.runtime.itemChargeDebits?.version===1&&offer?.actionKey?legacyReceipt:itemChargeKnownStateVersion(c.runtime.itemChargeDebits?.version)?itemChargeBoundReceipt(c,ownerId):undefined,visible=action?.scope===c.id?action:undefined;
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&receipt?.id===visible.id){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[receipt,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const number=/^(?:0|[1-9]\d*)$/.test(remaining)?Number(remaining):undefined,capacity=typeof offer?.capacity==='number'&&Number.isSafeInteger(offer.capacity)&&offer.capacity>=1&&offer.capacity<=10000?offer.capacity:undefined,restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 const canAcquire=!!offer?.canAcquire&&!restricted&&!busy&&genuine&&known&&number!==undefined&&Number.isSafeInteger(number)&&capacity!==undefined&&number<=capacity;
 const variableActions=offer?.variableActions||[],branchMatches=variableActions.filter(row=>row.key===branchKey),branch=branchMatches.length===1?branchMatches[0]:undefined,cost=branch?.allowedCosts.find(value=>Number.isSafeInteger(value)&&value>0&&String(value)===costChoice);
 const contextsKnown=!!branch&&branch.requiredContext.every(code=>Object.hasOwn(CONTEXT_LABELS,code)),contextsConfirmed=contextsKnown&&branch!.requiredContext.every(code=>Object.hasOwn(context,code)&&context[code]===true);
 const canVariableDebit=!!offer&&!!branch&&!restricted&&!busy&&offer.initialized&&branch.canDebit&&cost!==undefined&&typeof offer.remaining==='number'&&Number.isSafeInteger(offer.remaining)&&offer.remaining>=cost+branch.minAfter&&contextsConfirmed;
 function cancel(){epoch.current++;flight.current=undefined;clearDraft();setAction(undefined);}
 function submit(kind:'acquire'|'debit'|'variable-debit'|'withdraw'){
  if(flight.current||restricted||busy||!offer||kind==='acquire'&&!canAcquire||kind==='debit'&&!offer.canDebit||kind==='variable-debit'&&!canVariableDebit||kind==='withdraw'&&!offer.canWithdraw)return;
  const token=epoch.current,scope=c.id,expected=offer.basis,id=crypto.randomUUID(),request=itemChargeRequest(c,ownerId,id,kind==='acquire'?{kind,knownRemaining:number!,confirmedGenuineItem:true,confirmedKnownBalance:true}:kind==='debit'?{kind,actionKey:offer.actionKey!}:kind==='variable-debit'?{kind,branchKey:branch!.key,cost:cost!,context:Object.fromEntries(branch!.requiredContext.map(code=>[code,true])) as Record<string,true>}:{kind});
  flight.current=id;setAction({id,scope,phase:'pending'});clearDraft();let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,rows=itemChargeOffers(draft,access).filter(row=>row.ownerId===ownerId);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||current.ownerId!==ownerId||!current.writable||!current.active||!access.canEdit||rows.length!==1||rows[0].basis!==expected){if(mounted.current){flight.current=undefined;setAction({id,scope,phase:'rejected',message:'物品、余额、权限或核对草稿已变化，未执行。'});}return;}
   const result=performItemChargeAction(draft,request,access);if(result.status==='rejected'){flight.current=undefined;setAction({id,scope,phase:'rejected',message:result.message});}
  });}catch(error){flight.current=undefined;setAction({id,scope,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 if(!offer)return <p role="status">物品充能当前无法唯一核对；未获得或重置任何充能。</p>;
 return <fieldset className="source-spell-choice" data-item-charge-use="" data-item-charge-owner={ownerId} disabled={restricted}>
  <legend>物品充能记账 · {offer.ownerName}</legend>
  <p>{offer.withdrawn?'此物理实例已撤回，余额及历史保留。':offer.initialized?`当前已记录剩余 ${offer.remaining??'待核对'} / ${offer.capacity??'待核对'} 充能。`:'尚未记录真实物品与当前已知余额；打开、装备或刷新不会获得满充能。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <p>这里只记录来源已核对的固定费用，不执行物品动作、施法或效果，不恢复或重置。目标、命令、触发与使用条件、动作和施法时间、施法属性、攻击与 DC、伤害、持续时间、专注及失效均需人工处理；确认不能解除尚未适配的来源限制。</p>
  {capacity!==undefined?<label>当前已知剩余<input aria-label="物品充能当前已知剩余" type="number" min="0" max={capacity} value={remaining} disabled={!offer.canAcquire||busy} onChange={event=>{setRemaining(event.target.value);setKnown(false);epoch.current++;}}/></label>:<p>充能容量尚未通过当前来源核对，保持只读。</p>}
  <label><input type="checkbox" aria-label="确认本次物品是真实物理实例" checked={genuine} disabled={!offer.canAcquire||busy} onChange={event=>setGenuine(event.target.checked)}/>确认这是当前真实物理实例，不是刷新或旧记录重复领取。</label>
  <label><input type="checkbox" aria-label="确认物品当前充能已核对" checked={known} disabled={!offer.canAcquire||busy} onChange={event=>setKnown(event.target.checked)}/>确认已核对当前剩余，可明确记录 0；不会默认为满充能。</label>
  {offer.actionKey&&<><p>记录固定费用分支：<code>{offer.actionKey}</code> · 费用 1 充能。{offer.minAfter===1?'必须至少保留 1 充能；末次耗尽分支尚未支持。':'本分支可记录至 0 充能；不会恢复。'}</p>{offer.requiresAttunement===true?<small>此记账分支要求先在背包中记录当前已装备且已同调；记录余额与扣费都会核对这两项现有标记。实际装备／同调程序、限制和效果仍须人工核对；不会自动装备或同调。</small>:offer.equipmentRequired&&<small>此记账分支要求已标记装备；实际穿戴／持用及其他条件仍须人工核对。</small>}{offer.fixedUnits&&<p>本分支固定单位：{Object.entries(offer.fixedUnits).map(([key,value])=>`${key}=${value}`).join('，')}；不包含其他环阶、数量或费用分支。</p>}{!!offer.manualBoundaries?.length&&<details><summary>仍需人工核对的条件标识</summary><ul>{offer.manualBoundaries.map(code=><li key={code}><code>{code}</code></li>)}</ul></details>}</>}
  {variableActions.length>0&&<section aria-label="来源可选费用记账" data-variable-item-charge="">
   <p>只允许选择当前已核对的来源分支和费用，不接受任意扣除数量。以下声明仅核对本次触发与现场条件，不授予使用资格，不自动执行动作、法术、攻击、伤害或物品效果。</p>
   {!offer.actionKey&&offer.requiresAttunement===true&&<small>此记账分支要求先在背包中记录当前已装备且已同调；实际装备／同调程序、限制和效果仍须人工核对，不会自动装备或同调。</small>}
   <label>来源分支<select aria-label="物品充能来源分支" value={branchKey} disabled={restricted||busy||!offer.initialized||offer.withdrawn} onChange={event=>{setBranchKey(event.target.value);setCostChoice('');setContext({});epoch.current++;}}><option value="">请选择本次来源分支</option>{variableActions.map(row=><option key={row.key} value={row.key}>{row.key}</option>)}</select></label>
   <label>来源费用<select aria-label="物品充能来源费用" value={costChoice} disabled={restricted||busy||!branch||!offer.initialized||offer.withdrawn} onChange={event=>{setCostChoice(event.target.value);setContext({});epoch.current++;}}><option value="">请选择本次来源费用</option>{branch?.allowedCosts.map(value=><option key={value} value={String(value)}>{value} 充能</option>)}</select></label>
   {branch&&<><p>{branch.minAfter===1?'本分支必须至少保留 1 充能；末次耗尽仍未支持。':'本分支可记录至 0 充能；不会恢复。'}</p>{branch.reason&&<p role="note">{branch.reason}</p>}{branch.requiredContext.map(code=><label key={code}><input type="checkbox" aria-label={`核对本次来源条件 ${code}`} checked={context[code]===true} disabled={busy||!branch.canDebit||cost===undefined||!Object.hasOwn(CONTEXT_LABELS,code)} onChange={event=>{setContext(old=>({...old,[code]:event.target.checked}));epoch.current++;}}/>{CONTEXT_LABELS[code]||`尚未适配的来源条件：${code}`}</label>)}{!contextsKnown&&<p role="note">本分支仍有未适配的条件标识，不能通过勾选解除。</p>}{!!branch.manualBoundaries.length&&<details><summary>所选分支仍需人工处理</summary><ul>{branch.manualBoundaries.map(code=><li key={code}><code>{code}</code></li>)}</ul></details>}</>}
   {cost!==undefined&&branch&&offer.remaining!==undefined&&offer.remaining<cost+branch.minAfter&&<p role="note">当前余额不足以支付所选费用并保留来源要求的充能。</p>}
   <button disabled={!canVariableDebit} onClick={()=>submit('variable-debit')}>记录所选来源分支{cost===undefined?'':` · 扣 ${cost} 充能`}</button>
   <p>仅首次成功执行这类来源可选费用分支后，充能历史升级为 v2（即使本次费用为 1）；打开、记录余额或执行原固定 1 费用不会升级或改写既有事件。旧客户端将 v2 作为未知版本只读保留；保留字段不等于可安全编辑。不要在旧版改动物品实例、来源或充能记录，返回新版后核对完整历史；不能把 v2 当成固定减 1 历史重写、降级或补发充能。</p>
  </section>}
  {offer.debitReason&&<p role="note">{offer.debitReason}</p>}
  <div className="spell-action-buttons"><button disabled={!canAcquire} onClick={()=>submit('acquire')}>确认记录物品充能</button>{offer.initialized&&(offer.actionKey||!variableActions.length)&&<button disabled={busy||!offer.canDebit} onClick={()=>submit('debit')}>记录固定费用分支 · 扣 1 充能</button>}<button disabled={!offer.canAcquire&&!offer.canWithdraw} onClick={cancel}>取消物品充能核对</button>{offer.initialized&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit('withdraw')}>撤销此物品充能记账</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-item-charge-phase={visible.phase}>{visible.phase==='applied'?'物品充能操作已由当前卡面确认':visible.phase==='rejected'?'物品充能操作未执行':'等待物品充能卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="item-charge-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
