import {it,expect} from 'vitest';
import {confirmInfusionChargePresentation,type InfusionChargePresentation} from '../src/ui/infusionChargePresentation';
const pending:InfusionChargePresentation={id:'request-a',scope:'card-a',title:'斥力之盾',phase:'pending'};
const receipt={id:'request-a',before:2,after:1};
it('only this card matching observed receipt confirms charge application',()=>{
 expect(confirmInfusionChargePresentation(pending,'card-a',receipt)).toEqual({...pending,phase:'applied',receipt,message:undefined});expect(pending.phase).toBe('pending');
});
it.each(['card','request','missing'] as const)('ignores %s mismatches and never invents durable saving',kind=>{
 const result=confirmInfusionChargePresentation(pending,kind==='card'?'card-b':'card-a',kind==='missing'?undefined:kind==='request'?{...receipt,id:'request-b'}:receipt);expect(result).toBe(pending);expect(JSON.stringify(result)).not.toContain('已保存');
});
it('late matching confirmation clears the unknown state without another action',()=>{
 const unknown={...pending,phase:'unconfirmed' as const,message:'waiting'};expect(confirmInfusionChargePresentation(unknown,'card-a',receipt)).toEqual({...pending,phase:'applied',receipt,message:undefined});
});
it.each(['rejected','applied'] as const)('does not rewrite the terminal %s feedback',phase=>{
 const terminal={...pending,phase};expect(confirmInfusionChargePresentation(terminal,'card-a',receipt)).toBe(terminal);
});
it('explicit initialization retains absent before instead of inventing zero',()=>{
 const initial={id:'request-a',after:0};expect(confirmInfusionChargePresentation(pending,'card-a',initial)?.receipt).toEqual(initial);
});

import {rejectInfusionChargePresentation} from '../src/ui/infusionChargePresentation';
it('a deferred rejection cannot overwrite a later request or another card',()=>{
 const newer={...pending,id:'new-request'};expect(rejectInfusionChargePresentation(newer,pending.id,pending.scope,'old rejection')).toBe(newer);expect(rejectInfusionChargePresentation(pending,pending.id,'other-card','old rejection')).toBe(pending);expect(rejectInfusionChargePresentation(undefined,pending.id,pending.scope,'old rejection')).toBeUndefined();
});
it('a matching actual rejection ends only its own pending presentation',()=>{
 expect(rejectInfusionChargePresentation(pending,pending.id,pending.scope,'stale')).toEqual({...pending,phase:'rejected',message:'stale'});
});
