export type InfusionChargeObservedReceipt={id:string;before?:number;after:number};
export type InfusionChargePresentation={id:string;scope:string;title:string;phase:'pending'|'applied'|'unconfirmed'|'rejected';message?:string;receipt?:InfusionChargeObservedReceipt};
/** A draft result is not persistence. Only this card's observed matching receipt
 * confirms application; the surrounding save status reports durable storage. */
export function confirmInfusionChargePresentation(action:InfusionChargePresentation|undefined,scope:string,receipt:InfusionChargeObservedReceipt|undefined){
 if(!action||action.scope!==scope||receipt?.id!==action.id||!['pending','unconfirmed'].includes(action.phase))return action;
 return {...action,phase:'applied' as const,receipt,message:undefined};
}

export const infusionChargePresentationBusy=(action:InfusionChargePresentation|undefined)=>action?.phase==='pending'||action?.phase==='unconfirmed';

/** A deferred refusal from a superseded target must not replace newer intent. */
export function rejectInfusionChargePresentation(action:InfusionChargePresentation|undefined,id:string,scope:string,message:string){
 return action?.id===id&&action.scope===scope?{...action,phase:'rejected' as const,message}:action;
}
