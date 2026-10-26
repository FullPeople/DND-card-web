import type {RefuelingRingReceipt} from '../core/automation/refuelingRing';
export type RefuelingRingPresentation={id:string;scope:string;phase:'pending'|'applied'|'unconfirmed'|'rejected';message?:string;receipt?:RefuelingRingReceipt};
export const refuelingRingPresentationBusy=(action:RefuelingRingPresentation|undefined)=>action?.phase==='pending'||action?.phase==='unconfirmed';
export function confirmRefuelingRingPresentation(action:RefuelingRingPresentation|undefined,scope:string,receipt:RefuelingRingReceipt|undefined){
 if(!action||action.scope!==scope||receipt?.id!==action.id||!['pending','unconfirmed'].includes(action.phase))return action;
 return {...action,phase:'applied' as const,receipt,message:undefined};
}
export function rejectRefuelingRingPresentation(action:RefuelingRingPresentation|undefined,id:string,scope:string,message:string){return action?.id===id&&action.scope===scope?{...action,phase:'rejected' as const,message}:action;}
