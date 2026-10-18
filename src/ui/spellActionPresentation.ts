import type {SpellActionReceipt} from '../core/automation/actions';
export type SpellPresentation={id:string;scope:string;title:string;payment:string;mode:'cast'|'restore';phase:'pending'|'applied'|'unconfirmed'|'rejected';message?:string;receipt?:SpellActionReceipt};
/** Late success clears the waiting message; another request/card proves nothing. */
export function confirmSpellPresentation(action:SpellPresentation|undefined,scope:string,receipt:SpellActionReceipt|undefined){
 if(!action||action.scope!==scope||receipt?.id!==action.id||!['pending','unconfirmed'].includes(action.phase))return action;
 return {...action,phase:'applied' as const,receipt,message:undefined};
}
