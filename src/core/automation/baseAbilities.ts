import {ABILITIES,type Ability,type Character,type Selection,type Issue} from '../model';
import {planRacialAbilities} from '../racialAbilities';
import {reviewedArmorFeatIdentity,reviewedWeaponMasterIdentity,reviewedSkilledIdentity,reviewedLinguistIdentity} from './reviewedFeatIdentity';
import {invocationSkillScope} from './invocations';

/** The pre-advancement layer is shared with training/prerequisite projections.
 * It never calls the full engine, so armor chains cannot recurse through AC. */
export function baseAbilityScores(c:Character,active:Selection[]){
 const abilities={...c.abilities},trace=Object.fromEntries(ABILITIES.map(a=>[a,[`基础 ${abilities[a]}`]])) as Record<Ability,string[]>,issues:Issue[]=[];
 for(const selection of active){
  const e=selection.entry,origin=`${e.name} · ${e.source}`;
  if(reviewedArmorFeatIdentity(e)||reviewedWeaponMasterIdentity(e)||reviewedSkilledIdentity(e)||reviewedLinguistIdentity(e))continue;
  if(e.kind==='race'){
   const racial=planRacialAbilities(c,selection);issues.push(...racial.issues);
   for(const a of ABILITIES){abilities[a]+=racial.bonuses[a]||0;if(racial.trace[a])trace[a].push(...racial.trace[a]!);}
  }
  if(e.kind==='background'||invocationSkillScope(c,selection))continue;
  for(const effect of e.effects||[])if(effect.op!=='proficiency'&&ABILITIES.includes(effect.target as Ability)){
   const a=effect.target as Ability;abilities[a]=effect.op==='set'?effect.value:abilities[a]+effect.value;trace[a].push(`${origin} ${effect.op==='set'?'=':'+'}${effect.value}`);
  }
 }
 return {abilities,trace,issues};
}
