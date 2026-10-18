import {describe,expect,it} from 'vitest';
import {confirmSpellPresentation,type SpellPresentation} from '../src/ui/spellActionPresentation';
import type {SpellActionReceipt} from '../src/core/automation/actions';
const action:SpellPresentation={id:'request-a',scope:'card-a',title:'原创术式',payment:'来源次数',mode:'cast',phase:'pending'};
const receipt:SpellActionReceipt={id:'request-a',sequence:0,fingerprint:'authored',selectionId:'spell',mode:'cast',level:1,resourceId:'pool',before:2,after:1};
describe('spell feedback follows actual controlled receipts',()=>{
 it('confirms the matching request and preserves the actual consumption',()=>{expect(confirmSpellPresentation(action,'card-a',receipt)).toMatchObject({phase:'applied',receipt:{before:2,after:1}});expect(action.phase).toBe('pending');});
 it('clears an expired waiting message after a late receipt',()=>{const result=confirmSpellPresentation({...action,phase:'unconfirmed',message:'等待确认'},'card-a',receipt);expect(result?.phase).toBe('applied');expect(result?.message).toBeUndefined();});
 it('never treats another card or request as confirmation',()=>{expect(confirmSpellPresentation(action,'card-b',receipt)).toBe(action);expect(confirmSpellPresentation(action,'card-a',{...receipt,id:'request-b'})).toBe(action);expect(confirmSpellPresentation(action,'card-a',undefined)).toBe(action);});
 it('does not replay a completed or rejected duplicate',()=>{for(const phase of ['applied','rejected'] as const){const settled={...action,phase};expect(confirmSpellPresentation(settled,'card-a',receipt)).toBe(settled);}});
});
