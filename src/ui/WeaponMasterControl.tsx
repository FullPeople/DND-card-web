import {useEffect,useState} from 'react';
import {ABILITY_LABELS,type Character,type Entry} from '../core/model';
import {reviewedFeatStatus,setReviewedFeatIntent} from '../core/automation/reviewedFeats';
import {reviewedWeaponNeedsFirearmsConsent,reviewedWeaponOptions} from '../core/automation/reviewedWeapons';

type Props={c:Character;catalog:Entry[];choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
const emptyWeapons=()=>['','','',''];
/** Four weapon kinds, never four equipment instances or an implicit grant. */
export function WeaponMasterControl({c,catalog,choiceId,entry,unavailable,writable,edit}:Props){
 const status=reviewedFeatStatus(c,choiceId,entry.id),intent=status.binding?.intent;
 const stored=intent?.kind==='weapon-master'?intent:undefined,saved=JSON.stringify(stored||{});
 const options=reviewedWeaponOptions(c,catalog);
 const [ability,setAbility]=useState<''|'str'|'dex'>(stored?.ability||''),[weapons,setWeapons]=useState<string[]>(()=>stored?[...stored.weapons]:emptyWeapons()),[confirmed,setConfirmed]=useState(false),[dmAllowed,setDmAllowed]=useState(stored?.confirmedDmFirearmsAllowed===true),[error,setError]=useState('');
 const manualBasis=JSON.stringify([c.abilities,c.training?.weapons]);
 const basis=JSON.stringify([c.abilities,c.training?.weapons,c.profile,options.map(option=>[option.value,option.unavailable])]);
 useEffect(()=>{setAbility(stored?.ability||'');setWeapons(stored?[...stored.weapons]:emptyWeapons());setDmAllowed(stored?.confirmedDmFirearmsAllowed===true);setConfirmed(false);setError('');},[c.id,choiceId,entry.id,saved]);
 useEffect(()=>setConfirmed(false),[basis,status.eligible,status.selectionId,unavailable,writable]);
 const known=!c.reviewedWeaponMaster||c.reviewedWeaponMaster.version===1,canEdit=known&&writable&&!!edit;
 const blocked=!known?'此武器大师记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改武器大师。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 const picked=weapons.filter(Boolean),distinct=new Set(picked).size,duplicate=distinct!==picked.length;
 const needsDm=reviewedWeaponNeedsFirearmsConsent(picked);
 const valid=(!needsDm||dmAllowed)&&!!ability&&picked.length===4&&distinct===4&&picked.every(value=>options.some(option=>option.value===value&&!option.unavailable));
 const label=(value:string)=>options.find(option=>option.value===value)?.label||value;
 function save(remove=false){
  if(!canEdit||!remove&&(!!blocked||!valid||!confirmed))return;
  let applied=false;
  try{const owner=status.selectionId,previous=JSON.stringify(status.binding||null),characterId=c.id;edit!(draft=>{if(!remove&&JSON.stringify([draft.abilities,draft.training?.weapons])!==manualBasis)throw Error('手工基础属性或武器熟练记录已变化，请重新核对确认。');const current=reviewedFeatStatus(draft,choiceId,entry.id);if(draft.id!==characterId||!remove&&current.selectionId!==owner||JSON.stringify(current.binding||null)!==previous)throw Error('职业授予或确认记录已变化，请核对当前角色卡并重新确认。');setReviewedFeatIntent(draft,choiceId,entry.id,remove?null:{kind:'weapon-master',ability:ability as 'str'|'dex',weapons:[...weapons],confirmedManualAbilityExcluded:true,...(needsDm&&dmAllowed?{confirmedDmFirearmsAllowed:true as const}:{})});applied=true;});if(applied)setConfirmed(false);setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 return <div className="reviewed-feat-control weapon-master-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind="weapon-master" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <small>{status.binding?status.active?'武器大师已生效':'武器大师记录已保留，当前不生效':'尚未确认武器大师'}</small>
  <small>PHB 2014 武器大师：只选力量或敏捷一项 +1（上限 20），再选四种不同的简易或军用武器熟练。每种武器保留具体来源，不是获得四件装备。基础属性不改写，训练不写入手工记录。</small>
  <small>当前仅支持已核对的 52 种基础武器种类；特殊物品武器尚未支持，需手工记录。这不是完整物品筛选域的自动化。</small>
  <small>同种武器不能重复选择；已有熟练不会叠加熟练加值。捕网可选，但不会生成不存在的伤害。魔法武器仅在基础武器来源匹配时继承熟练；手写攻击公式、生命值和资源保持原样。</small>
  <small>已达 20 或超过 20 的属性不能启用本次提升，不会降低原值或自动换选其他属性。</small>
  <label>武器大师提升属性 <select aria-label="武器大师提升属性" value={ability} disabled={!!blocked} onChange={event=>{setAbility(event.target.value as ''|'str'|'dex');setConfirmed(false);setError('');}} style={{maxWidth:'100%'}}><option value="">请选择一项属性</option>{(['str','dex'] as const).map(key=><option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</select></label>
  <small aria-live="polite">已选 {distinct}/4（四种不同武器）{duplicate?'；重复选择不能确认':''}</small>
  {Array.from({length:4},(_,index)=><label key={index}>武器 {index+1} <select aria-label={`武器大师武器 ${index+1}`} value={weapons[index]||''} disabled={!!blocked} onChange={event=>{setWeapons(current=>current.map((value,slot)=>slot===index?event.target.value:value));setDmAllowed(false);setConfirmed(false);setError('');}} style={{width:'100%',maxWidth:'100%',minWidth:0}}><option value="">请选择来源明确的一种武器</option>{weapons[index]&&!options.some(option=>option.value===weapons[index])&&<option value={weapons[index]} disabled>{weapons[index]}（资料未载入，记录保留）</option>}{options.map(option=>{const repeated=weapons.some((value,slot)=>slot!==index&&value===option.value);return <option key={option.value} value={option.value} disabled={!!option.unavailable||repeated}>{option.label}{option.unavailable?`（${option.unavailable}）`:repeated?'（已在另一格选择）':''}</option>;})}</select></label>)}
  {needsDm&&<><small>所选 DMG 火器的熟练资格由 DM 决定；启用资料来源不等于已获许可。此处只记录玩家确认，不代替 DM 裁定，也不自动处理弹药、装填或扫射。</small><label><input type="checkbox" aria-label="确认DM允许所选火器熟练" checked={dmAllowed} disabled={!!blocked} onChange={event=>{setDmAllowed(event.target.checked);setConfirmed(false);}}/>已向 DM 确认：允许通过本次武器大师获得所选火器熟练</label></>}
  {options.length===0&&<small>武器资料尚未载入，不能确认新选择；已保存的来源记录保留。</small>}
  {stored&&<small>已保存：{ABILITY_LABELS[stored.ability]} +1；{stored.weapons.map(label).join('、')}。</small>}
  {c.training?.weapons!==undefined&&<small>当前武器熟练由手工记录覆盖{c.training.weapons===''?'（空记录）':''}；保留原文，不自动追加四种武器。属性提升仍按上限判断。</small>}
  {status.reason&&<small>{status.reason}</small>}
  <small>旧版客户端不支持武器大师派生，保留记录不代表安全往返；若曾在旧版改过此专长选择或手工数值，返回新版后请先撤回，再核对并重新确认；旧版改等级后原确认也可能失效。手工最终值覆盖仍保留。</small>
  <label><input type="checkbox" aria-label="确认武器大师未计入手工基础属性" checked={confirmed} disabled={!!blocked} onChange={event=>setConfirmed(event.target.checked)}/>已核对：本次武器大师 +1 尚未计入手工基础属性</label>
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!valid||!confirmed} onClick={()=>save()}>确认武器大师</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回武器大师</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
