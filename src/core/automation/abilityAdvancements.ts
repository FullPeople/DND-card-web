import {ABILITIES,type Ability,type Character,type Selection} from '../model';
import {asiGrantLevel,evaluateAsiAllocations,type AsiBinding} from './asi';
import {reviewedFeatGrantLevel,evaluateReviewedFeats,reviewedFeatBindings,type ReviewedFeatBinding} from './reviewedFeats';

/** All explicit score advancements share the cap in authenticated grant order.
 * Click order, import array order and adapter invocation order cannot decide
 * which earlier advancement survives. Individual adapters still own all gates. */
export interface AdvancementBoundary {level:number;choiceId:string;selectionId?:string}
export function evaluateAbilityAdvancements(c:Character,base:Record<Ability,number>,active?:Selection[],before?:AdvancementBoundary){
 const asi=evaluateAsiAllocations({...c,asiAllocations:c.asiAllocations?.version===1?undefined:c.asiAllocations},base,active);
 const reviewed=evaluateReviewedFeats({...c,reviewedFeats:c.reviewedFeats?.version===1?undefined:c.reviewedFeats,reviewedWeaponMaster:c.reviewedWeaponMaster?.version===1?undefined:c.reviewedWeaponMaster},base,active);
 const events:({kind:'asi';binding:AsiBinding;level:number}|{kind:'feat';binding:ReviewedFeatBinding;level:number})[]=[
  ...(c.asiAllocations?.version===1?c.asiAllocations.bindings.map(binding=>({kind:'asi' as const,binding,level:asiGrantLevel(c,binding.choiceId,active)??99})):[]),
  ...reviewedFeatBindings(c).map(binding=>({kind:'feat' as const,binding,level:reviewedFeatGrantLevel(c,binding.choiceId,binding.entryId,active)??99})),
 ];
 const current={...base};
 events.sort((a,b)=>a.level-b.level||a.binding.choiceId.localeCompare(b.binding.choiceId)||a.binding.entryId.localeCompare(b.binding.entryId));
 for(const event of events){
  if(before&&(event.level>before.level||event.level===before.level&&event.binding.choiceId.localeCompare(before.choiceId)>=0))continue;
  const result=event.kind==='asi'?evaluateAsiAllocations(c,current,active,event.binding):evaluateReviewedFeats(c,current,active,event.binding,reviewed.armorTraining,{level:event.level,choiceId:event.binding.choiceId,selectionId:event.binding.selectionId});
  const target=event.kind==='asi'?asi:reviewed;
  target.issues.push(...result.issues);for(const [key,state] of result.states)target.states.set(key,state);
  for(const ability of ABILITIES){current[ability]+=result.bonuses[ability];target.bonuses[ability]+=result.bonuses[ability];target.trace[ability].push(...result.trace[ability]);}
  if(event.kind==='feat'){const feat=result as ReturnType<typeof evaluateReviewedFeats>;reviewed.armorTraining.push(...feat.armorTraining);reviewed.armorTrace.push(...feat.armorTrace);reviewed.weaponTraining.push(...feat.weaponTraining);reviewed.weaponTrace.push(...feat.weaponTrace);reviewed.hpBonus+=feat.hpBonus;reviewed.hpTrace.push(...feat.hpTrace);for(const ability of feat.saves)reviewed.saves.add(ability);for(const ability of ABILITIES)reviewed.saveTrace[ability].push(...feat.saveTrace[ability]);}
 }
 return {asi,reviewed};
}
