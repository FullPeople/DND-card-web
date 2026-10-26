import {it,expect} from 'vitest';
import {radiantRefuelingFixture} from './helpers/radiantRefuelingFixture';
import {infusionRule,infusionTargets,setInfusionTarget,setInfusionHeld,evaluateInfusions} from '../src/core/automation/infusions';
import {infusionChargeActionRequest,performInfusionChargeAction,infusionChargeOffer} from '../src/core/automation/infusionCharges';
import {activeSelections} from '../src/core/automation/active';
it('Radiant Weapon level6 can bind a nonmagical weapon and adds a fixed attuned +1 at level20',()=>{
 const f=radiantRefuelingFixture('Radiant Weapon',20);
 expect(infusionTargets(f.c,f.infusion).map(x=>x.id)).toContain('weapon');
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,'weapon');
 expect(evaluateInfusions(f.c,activeSelections(f.c)).weapons.get('weapon')?.bonus).toBe(1);
});
it('Radiant explicitly initializes 0 then dawn restores actual d4 and held reaction spends one in v2 only',()=>{
 const f=radiantRefuelingFixture();expect(infusionRule(f.infusion)?.charges?.max).toBe(4);
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,'weapon');setInfusionHeld(f.c,f.choiceId,f.infusion.id,true);
 const act=(id:string,action:any)=>performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,id,action));
 expect(act('init',{kind:'initialize',initial:0}).status).toBe('applied');expect(f.c.runtime.infusionCharges?.version).toBe(2);
 expect(act('dawn',{kind:'dawn',dawnConfirmed:true,roll:3}).status).toBe('applied');
 expect(act('use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true}).status).toBe('applied');expect(infusionChargeOffer(f.c,f.choiceId,f.infusion.id).current).toBe(2);
});
it('Ring binds only source-reviewed nonmagical Signet Ring without AC, weapon or 4-charge projection',()=>{
 const f=radiantRefuelingFixture('Spell-Refueling Ring');expect(infusionTargets(f.c,f.infusion).map(x=>x.id)).toEqual(['ring']);
 setInfusionTarget(f.c,f.choiceId,f.infusion.id,'ring');const result=evaluateInfusions(f.c,activeSelections(f.c));
 expect(result.bonus).toBe(0);expect(result.weapons.size).toBe(0);expect(infusionChargeOffer(f.c,f.choiceId,f.infusion.id).supported).toBe(false);
});
