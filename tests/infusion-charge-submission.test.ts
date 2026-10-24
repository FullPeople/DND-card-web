import {it,expect,vi} from 'vitest';
import type {Character} from '../src/core/model';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import {dispatchInfusionChargeRequest,infusionChargeConfirmation} from '../src/ui/infusionChargeSubmission';
import {confirmInfusionChargePresentation,infusionChargePresentationBusy,type InfusionChargePresentation} from '../src/ui/infusionChargePresentation';
function setup(){const {c,choiceId,infusion,targetId}=infusionChargesFixture();setInfusionTarget(c,choiceId,infusion.id,targetId);setInfusionHeld(c,choiceId,infusion.id,true);performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,infusion.id,'init',{kind:'initialize',initial:2}));const request=infusionChargeActionRequest(c,choiceId,infusion.id,'spend',{kind:'use',triggerConfirmed:true,reactionConfirmed:true});const action:InfusionChargePresentation={id:request.id,scope:c.id,title:infusion.name,phase:'pending'};return {c,request,action};}
it('a deferred edit stays busy without false rejection, then confirms only the matching observed receipt',()=>{
 const {c,request,action}=setup(),before=structuredClone(c),rejected=vi.fn();let release:((c:Character)=>void)|undefined;dispatchInfusionChargeRequest(callback=>{release=callback;},request,rejected);expect(c).toEqual(before);expect(rejected).not.toHaveBeenCalled();expect(infusionChargePresentationBusy(action)).toBe(true);expect(confirmInfusionChargePresentation(action,c.id,c.runtime.infusionCharges?.last)).toBe(action);
 const unconfirmed={...action,phase:'unconfirmed' as const,message:'waiting'};expect(infusionChargePresentationBusy(unconfirmed)).toBe(true);release!(c);expect(rejected).not.toHaveBeenCalled();const applied=confirmInfusionChargePresentation(unconfirmed,c.id,c.runtime.infusionCharges?.last);expect(applied).toMatchObject({phase:'applied',message:undefined,receipt:{id:request.id,before:2,after:1}});expect(infusionChargePresentationBusy(applied)).toBe(false);
});
it('an omitted readonly callback cannot claim failure or success and writes nothing',()=>{
 const {c,request,action}=setup(),before=structuredClone(c),rejected=vi.fn();dispatchInfusionChargeRequest(()=>{},request,rejected);expect(rejected).not.toHaveBeenCalled();expect(c).toEqual(before);expect(infusionChargePresentationBusy(action)).toBe(true);expect(confirmInfusionChargePresentation(action,c.id,c.runtime.infusionCharges?.last)).toBe(action);
});
it('a late stale rejection is delivered after callback, does not mutate the card or masquerade as pending success',()=>{
 const {c,request}=setup(),rejected=vi.fn();let release:((c:Character)=>void)|undefined;dispatchInfusionChargeRequest(callback=>{release=callback;},request,rejected);c.revision++;const before=structuredClone(c);release!(c);expect(rejected).toHaveBeenCalledTimes(1);expect(rejected).toHaveBeenCalledWith(expect.stringContaining('已变化'));expect(c).toEqual(before);
});
it('repeating exactly one request is zero-write and retains the same receipt',()=>{
 const {c,request}=setup(),rejected=vi.fn();dispatchInfusionChargeRequest(callback=>callback(c),request,rejected);const before=structuredClone(c);dispatchInfusionChargeRequest(callback=>callback(c),request,rejected);expect(c).toEqual(before);expect(rejected).not.toHaveBeenCalled();
});
it('an explicit thrown edit failure is reported without claiming persistence',()=>{
 const {c,request}=setup(),before=structuredClone(c),rejected=vi.fn();dispatchInfusionChargeRequest(()=>{throw Error('只读拒绝');},request,rejected);expect(rejected).toHaveBeenCalledWith('只读拒绝');expect(c).toEqual(before);
});
it.each(['',' ','-1','5','1.5','NaN','04'])('refuses an invalid initial selection %j without coercing it to a balance',value=>{expect(infusionChargeConfirmation('initialize',value,false,false)).toBeUndefined();});
it.each(['0','1','2','3','4'])('accepts explicitly selected initial %s',value=>{expect(infusionChargeConfirmation('initialize',value,false,false)).toEqual({kind:'initialize',initial:Number(value)});});
it.each([[false,false],[true,false],[false,true]])('does not create a reaction action with trigger=%s/reaction=%s', (trigger,reaction)=>{expect(infusionChargeConfirmation('use','',trigger,reaction)).toBeUndefined();});
it('requires both trigger and reaction with no automatic round tracking',()=>{expect(infusionChargeConfirmation('use','',true,true)).toEqual({kind:'use',triggerConfirmed:true,reactionConfirmed:true});});
it.each(['','0','5','2.5',' 2'])('refuses actual dawn roll %j',value=>{expect(infusionChargeConfirmation('dawn',value,true,false)).toBeUndefined();});
it.each(['1','2','3','4'])('requires explicit new dawn for actual roll %s',value=>{expect(infusionChargeConfirmation('dawn',value,false,false)).toBeUndefined();expect(infusionChargeConfirmation('dawn',value,true,false)).toEqual({kind:'dawn',dawnConfirmed:true,roll:Number(value)});});
