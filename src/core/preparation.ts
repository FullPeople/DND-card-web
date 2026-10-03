import {evaluateFormula} from '../data/automation/formula';
import {irMechanics,irFormulaValues} from './automation/ir';
import {evaluate} from './engine';
import {casterProfiles,type CasterProfile} from './spellcastingRules';
import {ABILITIES,type Character} from './model';

/** The shared formula whitelist also validates imported declarative rules. */
export function preparationFormula(formula:string,variables:Record<string,number>):number|undefined{
 try{return Math.max(1,Math.floor(evaluateFormula(formula,variables)));}catch{return undefined;}
}
export function preparationBase(c:Character):number|undefined{
 const profiles=casterProfiles(c).filter(p=>p.mode==='prepared');if(!profiles.length)return;
 const d=evaluate(c);let total=0;
 for(const p of profiles){const value=profilePreparation(c,p,d);if(value===undefined)return;total+=value;}
 return total;
}
/** The same per-class formula feeds both the preparation workspace and choices. */
export function profilePreparation(c:Character,p:CasterProfile,d=evaluate(c)):number|undefined{
 const model=irMechanics(p.casting.entry)?.classModel,level=p.owner.level,table=model?.preparedProgression?.[level-1];
 if(typeof table==='number')return Math.max(0,table);
 return model?.preparedFormula?preparationFormula(model.preparedFormula,irFormulaValues(c,p.casting,d.abilities)):undefined;
}
