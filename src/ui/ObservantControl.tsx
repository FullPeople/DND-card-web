import {useEffect,useRef,useState} from 'react';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {useInteractionStatus} from './InteractionFeedback';
import {evaluate} from '../core/engine';
import type {Character,Entry} from '../core/model';
import {reviewedObservantBindings,reviewedObservantStatus,setReviewedObservantIntent} from '../core/automation/reviewedObservant';
type Props={c:Character;catalog:Entry[];choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
/** Review the same manual ownership, preceding advancements and source chain
 * inside the actual delayed edit. Consuming unrelated runtime resources is safe. */
const confirmationBasis=(c:Character)=>JSON.stringify([c.id,c.abilities,c.proficiencies,c.expertise,c.skillBonuses,c.jackOfAllTrades,c.adjustments,c.sheetBonuses?.passive,c.profile,c.automation,c.asiAllocations,c.reviewedFeats,c.reviewedWeaponMaster,c.reviewedSkilled,c.reviewedLinguist,c.reviewedObservant,c.racialAbilityMode,c.answers,c.classChoiceSnapshots,c.classChoiceArchive,c.selections.map(row=>[row.id,row.parentId,row.requirementId,row.grantKey,row.level,row.entry])]);
export function ObservantControl({c,catalog,choiceId,entry,unavailable,writable,edit}:Props){
 const active=useRetainedCardActive(),persistence=useInteractionStatus(),consumed=useRef(false),draftEpoch=useRef(0),stored=reviewedObservantBindings(c).find(row=>row.choiceId===choiceId&&row.entryId===entry.id)?.intent,saved=JSON.stringify(stored||{});
 const [ability,setAbility]=useState<'int'|'wis'|''>(stored?.ability||''),[manual,setManual]=useState(false),[passives,setPassives]=useState(false),[error,setError]=useState('');
 const status=reviewedObservantStatus(c,choiceId,entry.id,ability||undefined),derived=evaluate(c),characterBasis=confirmationBasis(c),catalogBasis=JSON.stringify(catalog.filter(row=>row.kind==='feat'&&(row.english==='Observant'||row.id===entry.id))),basis=JSON.stringify([characterBasis,catalogBasis]);
 function clearConsent(){draftEpoch.current++;setManual(false);setPassives(false);consumed.current=false;}
 function reset(){setAbility(stored?.ability||'');clearConsent();setError('');}
 useEffect(()=>()=>{draftEpoch.current++;},[]);
 useEffect(reset,[c.id,choiceId,entry.id,saved]);useEffect(clearConsent,[basis,status.eligible,status.selectionId,unavailable,writable]);
 const known=!c.reviewedObservant||c.reviewedObservant.version===1,canEdit=known&&writable&&!!edit&&active;
 const blocked=!known?'此观察力记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改观察力。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 function save(remove=false){
  if(consumed.current||!canEdit||!remove&&(!!blocked||!ability||!manual||!passives))return;
  consumed.current=true;const epoch=draftEpoch.current;let applied=false;
  try{const owner=status.selectionId,previous=JSON.stringify(status.binding||null),characterId=c.id;edit!(draft=>{
   if(draftEpoch.current!==epoch)throw Error('观察力编辑草稿已取消或不再可写，请重新核对。');
   const current=reviewedObservantStatus(draft,choiceId,entry.id);
   if(draft.id!==characterId||JSON.stringify(current.binding||null)!==previous||!remove&&(current.selectionId!==owner||confirmationBasis(draft)!==characterBasis||JSON.stringify(catalog.filter(row=>row.kind==='feat'&&(row.english==='Observant'||row.id===entry.id)))!==catalogBasis))throw Error('基础属性、技能、被动手工值、此前属性提升或职业授予记录已变化，请重新核对确认。');
   setReviewedObservantIntent(draft,choiceId,entry.id,remove?null:{kind:'observant',ability:ability as 'int'|'wis',confirmedManualAbilityExcluded:true,confirmedManualPassivesExcluded:true},catalog);applied=true;
  });if(applied){setManual(false);setPassives(false);}else consumed.current=false;setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){clearConsent();setError(reason instanceof Error?reason.message:String(reason));}
 }
 const currentAbility=stored?.ability||ability,changed=!!stored&&ability!==stored.ability,natural=10+derived.skills.perception.value+(status.passivesActive?5:0),investigation=derived.passiveInvestigation??10+derived.skills.investigation.value,absolute=(c.adjustments||[]).filter(row=>row.target==='passive'&&row.reason.trim()).at(-1);
 return <div className="reviewed-feat-control observant-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind="observant" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={reset}/><small>{status.binding?status.active?'观察力已生效':'观察力记录已保留，当前不生效':'尚未确认观察力'}</small>
  <small>PHB 2014 观察力：智力或感知 +1，上限 20；被动察觉与被动调查各 +5。确认前不授予，不改写基础属性或手工值。</small>
  <label>提升属性 <select aria-label="观察力提升属性" value={ability} disabled={!!blocked} onChange={event=>{setAbility(event.target.value as 'int'|'wis'|'');clearConsent();setError('');}}><option value="">请选择智力或感知</option><option value="int">智力 INT</option><option value="wis">感知 WIS</option></select></label>
  <small data-testid="observant-ability-preview">{changed?'修改属性后按本次授予顺序重新核对上限':currentAbility?`本次 ${currentAbility.toUpperCase()} +${status.abilityBonus}${status.abilityBefore!==undefined?`（此前 ${status.abilityBefore} → ${status.abilityBefore+status.abilityBonus}）`:''}`:'只支持 INT 或 WIS；不选择其他属性'}{status.passivesActive?'；两项被动各 +5 仍生效':status.eligible?'；属性封顶的 +0 不阻止两项被动各 +5':''}</small>
  <small>当前自然被动察觉 {natural}；卡面最终被动察觉 {derived.passive}。当前被动调查 {investigation}。主动察觉检定 {derived.skills.perception.value}、主动调查检定 {derived.skills.investigation.value}；本专长的 +5 不加入主动技能，也不授予熟练或专精。</small>
  {absolute&&<small>被动察觉由手工最终值 {absolute.value} 覆盖自然结果（{absolute.reason}），再加既有卡面调整 {c.sheetBonuses?.passive||0}；此覆盖不取消属性或被动调查。卡面 passive 调整只属于被动察觉。</small>}
  <label><input type="checkbox" aria-label="确认观察力属性提升未计入手工基础值" checked={manual} disabled={!!blocked} onChange={event=>{draftEpoch.current++;setManual(event.target.checked);consumed.current=false;}}/>本次属性提升尚未计入手工基础值</label>
  <label><input type="checkbox" aria-label="确认观察力两项被动加值未计入手工值" checked={passives} disabled={!!blocked} onChange={event=>{draftEpoch.current++;setPassives(event.target.checked);consumed.current=false;}}/>已核对：本次两项被动 +5 尚未计入手工技能总值、技能额外调整、被动最终值或卡面调整，避免重复计算</label>
  <small>读唇仍手工：须能看见对方嘴唇／口部并理解所说语言；不自动判断视线、语言或读唇成功，不创建动作或资源。情境优势／劣势的被动修正仍由 DM 手工裁定。</small>
  <small>来源：{entry.name} · PHB · 本次职业属性提升选择。历史手工记录原样保留，不自动迁移为本次确认；XPHB 观察力是另一身份，不在本受审规则内。</small>
  <small>旧版客户端保留未知字段不等于可安全编辑；若改过父专长、基础属性、技能或被动手工值，回新版后先撤回、核对并重新确认；不能检测旧版是否清空后重选。</small>
  <small data-testid="observant-save-status">{persistence?.scope===c.id?persistence.saveLabel:'保存与同步结果请查看卡面状态'}</small>{status.reason&&<small>{status.reason}</small>}
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!ability||!manual||!passives} onClick={()=>save()}>确认观察力</button><button type="button" disabled={!canEdit} onClick={reset}>取消观察力编辑</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回观察力</button>}</div>{blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}{error&&<small role="alert">{error}</small>}
 </div>;
}
