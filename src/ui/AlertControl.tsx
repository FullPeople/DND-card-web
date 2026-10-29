import {useEffect,useRef,useState} from 'react';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {useInteractionStatus} from './InteractionFeedback';
import {evaluate} from '../core/engine';
import type {Character,Entry} from '../core/model';
import {evaluateReviewedAlert,reviewedAlertStatus,setReviewedAlertIntent} from '../core/automation/reviewedAlert';

type Props={c:Character;catalog:Entry[];choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
/** Final DEX, Jack/PB, hand-entered totals and offsets, ordered advancements,
 * owner/source and saved consent all belong to this review. Runtime spending
 * does not: consuming HP or a resource must neither invalidate nor refill it. */
const confirmationBasis=(c:Character)=>JSON.stringify([c.id,c.edition,c.abilities,c.jackOfAllTrades,c.adjustments,c.sheetBonuses?.initiative,c.sheetBonuses?.proficiency,c.profile,c.automation,c.asiAllocations,c.reviewedFeats,c.reviewedWeaponMaster,c.reviewedSkilled,c.reviewedLinguist,c.reviewedObservant,c.reviewedAlert,c.racialAbilityMode,c.answers,c.classChoiceSnapshots,c.classChoiceArchive,c.selections.map(row=>[row.id,row.parentId,row.requirementId,row.grantKey,row.level,row.entry])]);
/** A renamed/ill-typed row can still claim a canonical ID or raw family name.
 * Keep both editions in the draft basis; display name alone is not identity. */
const catalogBasis=(catalog:Entry[],entryId:string)=>JSON.stringify(catalog.filter(row=>row.id===entryId||row.id==='kiwee:feat:phb:alert::::::'||row.id==='kiwee:feat:xphb:alert::::::'||row.english==='Alert'||row.raw?.ENG_name==='Alert'));

export function AlertControl({c,catalog,choiceId,entry,unavailable,writable,edit}:Props){
 const active=useRetainedCardActive(),persistence=useInteractionStatus(),consumed=useRef(false),draftEpoch=useRef(0);
 const [manual,setManual]=useState(false),[error,setError]=useState('');
 const status=reviewedAlertStatus(c,choiceId,entry.id),derived=evaluate(c),saved=JSON.stringify(c.reviewedAlert),characterBasis=confirmationBasis(c),familyBasis=catalogBasis(catalog,entry.id),basis=JSON.stringify([characterBasis,familyBasis]);
 const known=!c.reviewedAlert||c.reviewedAlert.version===1,canEdit=known&&writable&&!!edit&&active;
 const live=useRef({basis,canEdit,unavailable,characterId:c.id});live.current={basis,canEdit,unavailable,characterId:c.id};
 function clearConsent(){draftEpoch.current++;setManual(false);consumed.current=false;}
 function reset(){clearConsent();setError('');}
 useEffect(()=>()=>{draftEpoch.current++;},[]);
 useEffect(reset,[c.id,choiceId,entry.id,saved]);
 useEffect(clearConsent,[basis,status.eligible,status.selectionId,unavailable,writable,active]);
 const blocked=!known?'此警觉记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改警觉。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 function save(remove=false){
  if(consumed.current||!canEdit||!remove&&(!!blocked||!manual))return;
  consumed.current=true;const epoch=draftEpoch.current,owner=status.selectionId,previous=JSON.stringify(c.reviewedAlert),characterId=c.id;let applied=false;
  try{
   edit!(draft=>{
    if(applied||draftEpoch.current!==epoch||!live.current.canEdit||live.current.characterId!==characterId||!remove&&(live.current.basis!==basis||live.current.unavailable))throw Error('警觉编辑草稿已取消或不再可写，请重新核对。');
    const current=reviewedAlertStatus(draft,choiceId,entry.id);
    if(draft.id!==characterId||JSON.stringify(draft.reviewedAlert)!==previous||!remove&&(current.selectionId!==owner||confirmationBasis(draft)!==characterBasis||catalogBasis(catalog,entry.id)!==familyBasis))throw Error('基础敏捷、先攻手工值、万事通、此前属性提升或职业授予记录已变化，请重新核对确认。');
    setReviewedAlertIntent(draft,choiceId,entry.id,remove?null:{kind:'alert',confirmedManualInitiativeExcluded:true},catalog);applied=true;
   });
   if(applied)clearConsent();
   setError(applied?'':'修改未提交，请查看卡面的只读或同步提示；重新核对后再试。');
  }catch(reason){clearConsent();setError(reason instanceof Error?reason.message:String(reason));}
 }
 const natural=derived.modifiers.dex+(c.jackOfAllTrades&&c.edition==='2014'?Math.floor(derived.proficiency/2):0)+evaluateReviewedAlert(c).initiativeBonus;
 const absolute=(c.adjustments||[]).filter(row=>row.target==='initiative'&&row.reason.trim()).at(-1);
 return <div className="reviewed-feat-control alert-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind="alert" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={reset}/>
  <small>{status.binding?status.active?'警觉已生效':'警觉记录已保留，当前不生效':'尚未确认警觉'}</small>
  <small>PHB 2014 警觉：另行确认后自然先攻 +5；不提升属性，不受属性上限影响。确认前不授予，不改写基础敏捷、手工先攻或资源。</small>
  <small data-testid="alert-initiative-preview">当前自然先攻 {natural}；卡面最终先攻 {derived.initiative}。自然结果使用最终敏捷调整值{c.jackOfAllTrades&&c.edition==='2014'?'与既有万事通半熟练加值':''}，再计入已生效的警觉 +5；手工最终值和卡面调整保持原优先级。</small>
  {absolute&&<small>先攻由手工最终值 {absolute.value} 覆盖自然结果（{absolute.reason}），再加既有卡面调整 {c.sheetBonuses?.initiative||0}；不会在此手工总值上再次叠加警觉 +5。</small>}
  <label><input type="checkbox" aria-label="确认警觉先攻加值未计入手工值" checked={manual} disabled={!!blocked} onChange={event=>{draftEpoch.current++;setManual(event.target.checked);consumed.current=false;setError('');}}/>已核对：本次先攻 +5 尚未计入手工先攻总值、手工最终值或卡面额外调整，避免重复计算</label>
  <small>清醒时的突袭规则与未见攻击者相关裁定仍手工；不自动判定清醒、突袭、视线、优势／劣势或战斗顺序，不创建动作或资源。</small>
  <small>来源：{entry.name} · PHB · 本次职业属性提升选择。XPHB 警觉是另一身份，其先攻熟练与交换先攻仍手工，不在本受审规则内。</small>
  <small>旧版客户端保留未知字段不等于可安全编辑；若改过父专长、基础敏捷或先攻手工值，回新版后先撤回、核对并重新确认；不能检测旧版是否清空后重选。</small>
  <small data-testid="alert-save-status">{persistence?.scope===c.id?persistence.saveLabel:'保存与同步结果请查看卡面状态'}</small>
  {status.reason&&<small>{status.reason}</small>}
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!manual||consumed.current} onClick={()=>save()}>确认警觉</button><button type="button" disabled={!canEdit} onClick={reset}>取消警觉编辑</button>{status.binding&&<button type="button" disabled={!canEdit||consumed.current} onClick={()=>save(true)}>撤回警觉</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}{error&&<small role="alert">{error}</small>}
 </div>;
}
