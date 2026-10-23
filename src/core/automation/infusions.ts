import type {Character,Entry,Selection,Issue} from '../model';
import {selectionEffectsAllowed} from '../model';
import {matchesReference} from '../entryReferences';
import {automationEnabled} from './state';
import {activeSelections} from './active';
import {armorRule,armorType} from './equipment';
import evidence from './infusionEvidence.json' with {type:'json'};

export interface InfusionBinding {choiceId:string;entryId:string;targetId:string}
export interface InfusionState {version:1;bindings:InfusionBinding[]}
/** Reviewed source-qualified identities, not display-name dispatch. Unknown
 * item/prerequisite families stay manual. Learning alone grants no effect. */
export function infusionRule(entry:Entry){
 if(entry.kind!=='feature'||entry.raw._category!=='optionalfeature'||!Array.isArray(entry.raw.featureType)||entry.raw.featureType.length!==1||entry.raw.featureType[0]!=='AI'||entry.raw._copy||entry.effects?.length)return;
 return evidence.rules.find(rule=>matchesReference(entry,rule.reference));
}
function nonmagical(row:Selection){
 const r=row.entry.raw;
 return row.quantity===1&&!!armorType(row.entry)&&!!armorRule(row).rule&&
  !r.reqAttune&&!r.magic&&!r.wondrous&&!r._copy&&!row.entry.effects?.length&&
  !Object.keys(r).some(key=>/^bonus/.test(key)&&r[key]!==undefined)&&
  r.rarity==='none'&&!r.tier&&!r.sentient&&!r.curse;
}
export function infusionTargets(c:Character):Selection[]{return activeSelections(c).filter(nonmagical);}
function learned(c:Character,binding:InfusionBinding){
 const entry=c.classChoiceSnapshots?.[binding.entryId],rule=entry&&infusionRule(entry);
 if(!entry||!rule||!selectionEffectsAllowed(c,entry))return;
 for(const owner of activeSelections(c)){
  if(owner.entry.kind!=='class'||!matchesReference(owner.entry,rule.owner)||owner.entry.edition==='2024'||!Number.isSafeInteger(owner.level)||owner.level<2||owner.level>20)continue;
  const feature=evidence.classFeatureReference;
  if(!Array.isArray(owner.entry.raw.classFeatures)||!owner.entry.raw.classFeatures.some((raw:unknown)=>(typeof raw==='string'?raw:(raw as any)?.classFeature)===feature)||c.dismissedFeatures?.includes(`${owner.id}|ref:${feature}`))continue;
  if(!activeSelections(c).some(row=>row.parentId===owner.id&&row.grantKey===`ref:${feature}`&&row.entry.raw._category==='classFeature'&&matchesReference(row.entry,feature)))continue;
  const groups=owner.entry.raw.optionalfeatureProgression;
  if(!Array.isArray(groups))continue;
  for(const [index,group] of groups.entries()){
   if(binding.choiceId!==`${owner.id}:class-optional:${index}`||!Array.isArray(group?.featureType)||group.featureType.length!==1||group.featureType[0]!=='AI'||JSON.stringify(group.progression)!==JSON.stringify(evidence.knownProgression))continue;
   const answers=(c.answers[binding.choiceId]||[]).slice(0,evidence.knownProgression[owner.level-1]);
   if(answers.includes(entry.id))return {entry,rule,owner};
  }
 }
}
export function canActivateInfusion(c:Character,choiceId:string,entryId:string):boolean{return automationEnabled(c)&&!!learned(c,{choiceId,entryId,targetId:''});}
/** Explicit activation/withdrawal modifies owned intent only, never equipment,
 * manual AC, notes, source snapshots, learned answers or resource balances. */
export function setInfusionTarget(c:Character,choiceId:string,entryId:string,targetId:string|null):void{
 const current=c.infusions;
 if(current&&current.version!==1)throw Error('此注法记录版本尚未支持，原数据保留。');
 const other=(current?.bindings||[]).filter(row=>row.choiceId!==choiceId||row.entryId!==entryId);
 if(targetId===null){if(current)current.bindings=other;return;}
 const next={choiceId,entryId,targetId},known=learned(c,next);
 if(!automationEnabled(c)||!known)throw Error('注法未有效学习或来源/自动化未启用。');
 if(!infusionTargets(c).some(row=>row.id===targetId))throw Error('请选择单件、非魔法的护甲或盾牌；堆叠物品请先拆分。');
 if(other.some(row=>row.targetId===targetId))throw Error('这件物品已有注法，请先撤销原注法。');
 if(other.some(row=>{const entry=c.classChoiceSnapshots?.[row.entryId];return entry&&infusionRule(entry)?.reference===known.rule.reference;}))throw Error('同一注法同时只能作用于一件物品。');
 const capacity=evidence.activeProgression[known.owner.level-1];
 if(other.length>=capacity)throw Error('已达注法物品上限，请先明确撤销一项；不会自动覆盖旧物品。');
 c.infusions={version:1,bindings:[...other,next]};
}
export function evaluateInfusions(c:Character,active:Selection[]):{bonus:number;trace:string[];issues:Issue[]}{
 const out={bonus:0,trace:[] as string[],issues:[] as Issue[]};
 if(!automationEnabled(c)||!c.infusions)return out;
 if(c.infusions.version!==1){out.issues.push({id:'infusion-version',severity:'warning',message:'注法记录版本尚未支持，原记录保留且未生效。'});return out;}
 const bindings=c.infusions.bindings;
 for(const binding of bindings){
  const known=learned(c,binding),target=active.find(row=>row.id===binding.targetId);
  let reason:string|undefined;
  if(!known)reason='已学记录、职业等级或来源当前不可用';
  else if(!target||!nonmagical(target))reason='目标不是可确认的单件非魔法护甲或盾牌';
  else if(bindings.filter(row=>row.targetId===binding.targetId).length!==1||bindings.filter(row=>{const entry=c.classChoiceSnapshots?.[row.entryId];return entry&&infusionRule(entry)?.reference===known.rule.reference;}).length!==1)reason='重复注法或目标冲突';
  else if(bindings.length>evidence.activeProgression[known.owner.level-1])reason='当前注法数量超出上限，请明确撤销多余记录';
  if(reason){out.issues.push({id:`infusion:${binding.choiceId}:${binding.entryId}`,severity:'warning',message:`注法暂不生效：${reason}；原记录保留。`});continue;}
  if(!target!.equipped){out.trace.push(`${known!.entry.name}：目标未穿戴，注法 AC 未生效`);continue;}
  // Match armor evaluator's conflicting-slot behavior. Do not apply an orphan
  // bonus when neither of two simultaneously worn armors has a valid base.
  const slot=armorType(target!.entry)==='S';
  if(active.filter(row=>row.equipped&&row.quantity>0&&!!armorType(row.entry)&&(armorType(row.entry)==='S')===slot).length!==1)continue;
  if(c.edition==='2024'&&slot){out.issues.push({id:`infusion-cross-edition:${binding.targetId}`,severity:'warning',message:'2014 注法与 2024 盾牌资格的组合尚未核对，注法 AC 未自动生效；目标记录保留。'});continue;}
  const bonus=known!.owner.level>=known!.rule.upgradeLevel?known!.rule.upgradedBonus:known!.rule.bonus;
  out.bonus+=bonus;out.trace.push(`${known!.entry.name} · ${known!.entry.source} → ${target!.entry.name}：注法 +${bonus}`);
 }
 return out;
}
export function validateInfusions(value:unknown):void{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isSafeInteger((value as any).version)||(value as any).version<1)throw Error('注法记录版本无效。');
 const state=value as InfusionState;if(state.version!==1)return;
 if(!Array.isArray(state.bindings)||state.bindings.length>100||state.bindings.some(row=>!row||typeof row!=='object'||['choiceId','entryId','targetId'].some(key=>typeof (row as any)[key]!=='string'||!(row as any)[key]||(row as any)[key].length>2000)))throw Error('注法目标记录无效。');
}
