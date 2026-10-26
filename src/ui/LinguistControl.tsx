import {useEffect,useRef,useState} from 'react';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {useInteractionStatus} from './InteractionFeedback';
import type {Character,Entry} from '../core/model';
import {reviewedLinguistOptions,reviewedLinguistStatus,setReviewedLinguistIntent} from '../core/automation/reviewedLinguist';

type Props={c:Character;catalog:Entry[];choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
const empty=()=>['','',''];
/** A delayed edit must review the same pre-event INT and genuine owner chain.
 * Runtime consumption is deliberately not part of this confirmation basis. */
const confirmationBasis=(c:Character)=>JSON.stringify([c.id,c.abilities,[c.training?.languages===undefined,c.training?.languages],c.profile,c.automation,c.asiAllocations,c.reviewedFeats,c.reviewedWeaponMaster,c.reviewedLinguist,c.racialAbilityMode,c.answers,c.classChoiceSnapshots,c.classChoiceArchive,c.selections.map(row=>[row.id,row.parentId,row.requirementId,row.grantKey,row.level,row.entry])]);
export function LinguistControl({c,catalog,choiceId,entry,unavailable,writable,edit}:Props){
 const active=useRetainedCardActive(),persistence=useInteractionStatus(),consumed=useRef(false);
 const status=reviewedLinguistStatus(c,choiceId,entry.id),stored=status.binding?.intent,saved=JSON.stringify(stored||{}),options=reviewedLinguistOptions(c,catalog);
 const storedValues=()=>stored?[...stored.languages]:empty();
 const [values,setValues]=useState<string[]>(storedValues),[manual,setManual]=useState(false),[dm,setDm]=useState(false),[error,setError]=useState('');
 const characterBasis=confirmationBasis(c),catalogBasis=JSON.stringify(options.map(row=>[row.value,row.unavailable,row.entry])),basis=JSON.stringify([characterBasis,catalogBasis]);
 function clearConsent(){setManual(false);setDm(false);consumed.current=false;}
 function reset(){setValues(storedValues());clearConsent();setError('');}
 useEffect(reset,[c.id,choiceId,entry.id,saved]);
 useEffect(clearConsent,[basis,status.eligible,status.selectionId,unavailable,writable]);
 const known=!c.reviewedLinguist||c.reviewedLinguist.version===1,canEdit=known&&writable&&!!edit&&active;
 const blocked=!known?'此语言学家记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改语言学家。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 const selected=values.filter(Boolean),distinct=new Set(selected).size,duplicate=distinct!==selected.length,restricted=selected.filter(value=>options.find(row=>row.value===value)?.restricted);
 const valid=selected.length===3&&distinct===3&&selected.every(value=>options.some(row=>row.value===value&&!row.unavailable));
 const label=(value:string)=>options.find(row=>row.value===value)?.entry.name||value;
 function save(remove=false){
  if(consumed.current||!canEdit||!remove&&(!!blocked||!valid||!manual||restricted.length>0&&!dm))return;
  consumed.current=true;let applied=false;
  try{const owner=status.selectionId,previous=JSON.stringify(status.binding||null),characterId=c.id;edit!(draft=>{
   const current=reviewedLinguistStatus(draft,choiceId,entry.id);
   if(draft.id!==characterId||JSON.stringify(current.binding||null)!==previous||!remove&&(current.selectionId!==owner||confirmationBasis(draft)!==characterBasis||JSON.stringify(reviewedLinguistOptions(draft,catalog).map(row=>[row.value,row.unavailable,row.entry]))!==catalogBasis))throw Error('基础智力、手工语言、此前属性提升或职业授予记录已变化，请重新核对确认。');
   setReviewedLinguistIntent(draft,choiceId,entry.id,remove?null:{kind:'linguist',languages:[...values],confirmedManualAbilityExcluded:true,dmAllowedLanguages:[...restricted]},catalog);applied=true;
  });if(applied){setManual(false);setDm(false);}else consumed.current=false;setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){clearConsent();setError(reason instanceof Error?reason.message:String(reason));}
 }
 const heading=!status.binding?'尚未确认语言学家':status.active?'语言学家已生效':status.abilityActive?'语言学家语言分量暂停；智力分量仍生效':'语言学家记录已保留，当前不生效';
 return <div className="reviewed-feat-control linguist-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind="linguist" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={reset}/>
  <small>{heading}</small>
  <small>PHB 2014 语言学家：固定智力 +1，上限 20；另选 3 种不同语言。确认前不产生效果，不改写手工基础属性。</small>
  <small>当前仅支持已核对的 18 种 PHB 语言：8 种标准、8 种异域和 2 种秘密语言。其他来源待适配，不代表规则禁止。原初语的四种方言只算一种语言。</small>
  <small data-testid="linguist-int-preview">{status.binding&&!status.abilityActive?'智力分量暂停':`本次 INT +${status.abilityBonus}${status.abilityBefore!==undefined?`（此前 ${status.abilityBefore} → ${status.abilityBefore+status.abilityBonus}）`:''}`}{status.abilityBonus===0&&status.languagesActive?'；语言仍生效':status.abilityBonus===0&&status.eligible?'；智力封顶不阻止合法三语言确认':''}</small>
  <small>已有同种语言不重复获得，建议换一种；不增加第四个名额，不删除原有来源，也不从手工文本推定来源或 DM 许可。历史手工专长与语言答案原样保留，不会自动迁移为本次受审确认。</small>
  <small aria-live="polite">已选 {distinct}/3{duplicate?'；重复选择不能确认':''}</small>
  {Array.from({length:3},(_,index)=><label key={index}>语言 {index+1} <select aria-label={`语言学家语言 ${index+1}`} value={values[index]||''} disabled={!!blocked} onChange={event=>{setValues(current=>current.map((value,slot)=>slot===index?event.target.value:value));clearConsent();setError('');}} style={{width:'100%',maxWidth:'100%',minWidth:0}}><option value="">请选择一种 PHB 语言</option>{values[index]&&!options.some(row=>row.value===values[index])&&<option value={values[index]} disabled>{values[index]}（待核对，记录保留）</option>}{options.map(row=>{const repeated=values.some((value,slot)=>slot!==index&&value===row.value);return <option key={row.value} value={row.value} disabled={!!row.unavailable||repeated}>{row.label}{row.unavailable?`（${row.unavailable}）`:repeated?'（已在另一格选择）':''}</option>;})}</select></label>)}
  {restricted.length>0&&<label><input type="checkbox" aria-label="确认所选受限语言已获 DM 许可" checked={dm} disabled={!!blocked} onChange={event=>{setDm(event.target.checked);consumed.current=false;}}/>DM 已许可本次所选异域／秘密语言：{restricted.map(label).join('、')}。许可只绑定这些 PHB 引用；更换任何语言后需重新核对。</label>}
  <label><input type="checkbox" aria-label="确认本次智力提升未计入手工基础值" checked={manual} disabled={!!blocked} onChange={event=>{setManual(event.target.checked);consumed.current=false;}}/>确认本次智力提升未计入手工基础值；若旧卡已经手工加过，请勿重复确认。</label>
  {stored&&<small>当前确认记录：{stored.languages.map(label).join('、')}。受限语言许可：{stored.dmAllowedLanguages.map(label).join('、')||'无（仅标准语言）'}。</small>}
  {c.training?.languages!==undefined&&<small>语言显示由手工记录覆盖{c.training.languages===''?'（空记录）':''}；原文保留，合法智力分量仍可生效。</small>}
  <small>来源：{entry.name} · PHB · 本次职业属性提升选择。密码制作、传授、破解和魔法解读仍手工；不创建密码、教学、解码或法术动作。</small>
  <small data-testid="linguist-save-status">{persistence?.scope===c.id?persistence.saveLabel:'保存与同步结果请查看卡面状态'}</small>
  {status.reason&&<small>{status.reason}</small>}{status.languageReason&&<small>{status.languageReason}</small>}
  <small>旧版客户端不支持此受审记录；保留未知字段不等于可安全编辑。若在旧版改过父专长、基础智力或手工语言，回新版后请先撤回，核对三语言、DM 许可和属性后重新确认；无法检测旧版是否清空后重选。</small>
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!valid||!manual||restricted.length>0&&!dm} onClick={()=>save()}>确认语言学家</button><button type="button" disabled={!canEdit} onClick={reset}>取消语言学家编辑</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回语言学家</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}{error&&<small role="alert">{error}</small>}
 </div>;
}
