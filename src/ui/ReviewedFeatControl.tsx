import {useEffect,useState} from 'react';
import {ABILITIES,ABILITY_LABELS,type Ability,type Character,type Entry} from '../core/model';
import {reviewedFeatRule,reviewedFeatStatus,setReviewedFeatIntent,type ReviewedFeatIntent,type ReviewedArmorFeatKind} from '../core/automation/reviewedFeats';

import {WeaponMasterControl} from './WeaponMasterControl';

type Props={catalog?:Entry[];c:Character;choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
const names={tough:'健壮',resilient:'强健','lightly-armored':'轻甲运用','moderately-armored':'中甲运用','heavily-armored':'重甲运用'};

/** A saved class-slot choice is not consent to alter a historical manual sheet. */
export function ReviewedFeatControl({c,catalog=[],choiceId,entry,unavailable,writable,edit}:Props){
 const rule=reviewedFeatRule(entry),status=rule?reviewedFeatStatus(c,choiceId,entry.id):{eligible:false,active:false,binding:undefined,reason:undefined};
 const intent=status.binding?.intent,saved=JSON.stringify(intent||{});
 const [ability,setAbility]=useState<Ability|''>(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 const manualBasis=JSON.stringify(rule?.kind==='tough'?[c.baseHp,c.sheetBonuses?.hp,c.adjustments?.filter(row=>row.target==='hp')]:[c.abilities,c.training?.armor]);
 useEffect(()=>{setAbility(intent&&intent.kind!=='tough'?intent.ability:'');setConfirmed(false);setError('');},[c.id,choiceId,entry.id,saved]);
 useEffect(()=>setConfirmed(false),[manualBasis,status.eligible,unavailable,writable]);
 if(!rule)return null;
 if(rule.kind==='weapon-master')return <WeaponMasterControl c={c} catalog={catalog} choiceId={choiceId} entry={entry} unavailable={unavailable} writable={writable} edit={edit}/>;
 const tough=rule.kind==='tough',resilient=rule.kind==='resilient',heavy=rule.kind==='heavily-armored';
 const known=!c.reviewedFeats||c.reviewedFeats.version===1,canEdit=writable&&!!edit&&known;
 const blocked=!known?'此被动专长记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改被动专长。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 const name=names[rule.kind],allowed:readonly Ability[]=rule.abilities||ABILITIES,selectedAbility=heavy?'str':ability,valid=tough||!!selectedAbility&&allowed.includes(selectedAbility);
 const chosen=intent&&intent.kind!=='tough'?intent.ability:selectedAbility;
 const manualSaveOff=resilient&&!!chosen&&c.proficiencies?.[`save:${chosen}`]===false;
 const training=rule.kind==='lightly-armored'?'轻甲训练':rule.kind==='moderately-armored'?'中甲、盾牌训练':'重甲训练';
 function save(remove=false){
  if(!canEdit||!remove&&(!!blocked||!valid||!confirmed))return;
  let applied=false;
  try{
   const next:ReviewedFeatIntent|null=remove?null:tough?{kind:'tough',confirmedManualHpExcluded:true}:resilient?{kind:'resilient',ability:selectedAbility as Ability,confirmedManualAbilityExcluded:true}:{kind:rule!.kind as ReviewedArmorFeatKind,ability:selectedAbility as 'str'|'dex',confirmedManualAbilityExcluded:true};
   edit!(draft=>{setReviewedFeatIntent(draft,choiceId,entry.id,next);applied=true;});
   if(applied)setConfirmed(false);
   setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 return <div className="reviewed-feat-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind={rule.kind} style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <small>{status.binding?status.active?`${name}已生效`:`${name}记录已保留，当前不生效`:`尚未确认${name}`}</small>
  {tough?<small>PHB 2014 健壮：生命值上限增加所有职业总等级 × 2，后续等级变化自动重算。不改写基础生命值或额外调整，不恢复当前生命值，不改变临时生命值。旧卡若已手工计入本专长，请勿重复启用。</small>:<>
   {resilient?<small>PHB 2014 强健：只选一项属性 +1（上限 20），同时获得同一属性的豁免熟练。重复获得熟练不会叠加熟练加值；手工取消的豁免熟练仍优先保留。基础属性不改写。</small>:<>
    <small>PHB 2014 {name}：{heavy?'固定提升力量 +1':'只选力量或敏捷一项 +1'}（上限 20），并获得{training}。基础属性不改写，训练不写入手工记录。</small>
    {rule.kind!=='lightly-armored'&&<small>前提：此前已有效获得{rule.kind==='moderately-armored'?'轻甲训练':'中甲训练'}。本次或更晚职业等级选择不能补足此前前提；来源失效或手工覆盖移除前提时，原确认保留但暂停生效。</small>}
    <small>2014 盾牌训练本身不额外增加 AC；仅使用已支持的装备训练与警告判断。施法限制、检定劣势和重甲力量／速度限制仍需人工核对。</small>
    {c.training?.armor!==undefined&&<small>当前护甲训练由手工记录覆盖{c.training.armor===''?'（空记录）':''}；保留原文，不自动追加{training}。属性提升仍按上限及前提条件判断。</small>}
   </>}
   <small>已达 20 或超过 20 的属性不能启用本次提升，不会降低原值或自动换选其他属性。{resilient?'选择体质时，规则计算的生命值会随调整值重算；手工生命值上限、当前及临时生命值保持原样。':'手工生命值上限、当前及临时生命值保持原样。'}</small>
   {!heavy&&<label>{name}提升属性 <select aria-label={`${name}提升属性`} value={ability} disabled={!!blocked} onChange={event=>{setAbility(event.target.value as Ability|'');setConfirmed(false);setError('');}} style={{maxWidth:'100%'}}><option value="">请选择一项属性</option>{allowed.map(key=><option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label>}
   {intent&&intent.kind!=='tough'&&<small>已保存：{ABILITY_LABELS[intent.ability]} +1；{resilient?`${ABILITY_LABELS[intent.ability]}豁免熟练`:training}。</small>}
   {manualSaveOff&&<small>当前{ABILITY_LABELS[chosen as Ability]}豁免已手工取消熟练；保留此覆盖，不添加熟练加值。属性提升仍按上述条件判断。</small>}
  </>}
  {status.reason&&<small>{status.reason}</small>}
  <small>旧版客户端可能只保留本记录、不应用效果；若曾在旧版改过专长选择或手工数值，请先撤回，再核对并重新确认。手工最终值覆盖仍保留。</small>
  <label><input type="checkbox" aria-label={tough?'确认健壮未计入手工生命值':`确认${name}未计入手工基础属性`} checked={confirmed} disabled={!!blocked} onChange={event=>setConfirmed(event.target.checked)}/>{tough?'已核对：健壮尚未计入手工基础生命值、额外加值或最终值修正':`已核对：本次${name} +1 尚未计入手工基础属性`}</label>
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!valid||!confirmed} onClick={()=>save()}>确认{name}</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回{name}</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
