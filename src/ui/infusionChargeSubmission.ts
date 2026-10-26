import type {Character} from '../core/model';
import {performInfusionChargeAction,type InfusionChargeAction,type InfusionChargeRequest} from '../core/automation/infusionCharges';

/** Empty selectors are not zero; confirmation is explicit for each operation. */
export function infusionChargeConfirmation(kind:InfusionChargeAction['kind'],value:string,trigger:boolean,reaction:boolean):InfusionChargeAction|undefined{
 if(kind==='use')return trigger&&reaction?{kind,triggerConfirmed:true,reactionConfirmed:true}:undefined;
 if(kind==='initialize')return /^[0-4]$/.test(value)?{kind,initial:Number(value)}:undefined;
 return trigger&&/^[1-4]$/.test(value)?{kind,dawnConfirmed:true,roll:Number(value)}:undefined;
}
/** Edit may defer or omit the callback. Neither proves failure or success.
 * Report only actual rejection here; application needs an observed receipt. */
export function dispatchInfusionChargeRequest(edit:(action:(draft:Character)=>void)=>void,request:InfusionChargeRequest,rejected:(message:string)=>void){
 try{edit(current=>{const result=performInfusionChargeAction(current,request);if(result.status==='rejected')rejected(result.message);});}
 catch(error){rejected(error instanceof Error?error.message:String(error));}
}
