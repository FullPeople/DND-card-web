import {describe,it,expect,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {newAutomationState} from '../src/core/automation/state';
import {applyRuntimeCharacterEdit,runtimeValueEdit,resourceBalanceEdit} from '../src/core/runtimeCharacterEdit';
import {createWorkbenchDerivation} from '../src/platform/workbenchDerivation';

function card(){const c=newCharacter();c.automation=newAutomationState();c.runtime.resources.manual={current:2,max:4};return c;}
describe('workbench derived values across edits and room rules',()=>{
 it('reuses one result across explicit balance forks without changing exported values',()=>{
  const c=card(),compute=vi.fn(evaluate),derive=createWorkbenchDerivation(compute);
  for(const action of [runtimeValueEdit('hp',8),runtimeValueEdit('tempHp',3),resourceBalanceEdit('manual',1)]){
   const next=applyRuntimeCharacterEdit(c,action)!;expect(next).toBeDefined();
   expect(derive(c)).toEqual(evaluate(c));expect(derive(next)).toEqual(evaluate(next));
  }
  expect(compute).toHaveBeenCalledTimes(1);expect(c.runtime.hp).toBe(0);expect(c.runtime.resources.manual.current).toBe(2);
 });
 it('invalidates after a build edit or a new authoritative document even with the same character ID',()=>{
  const c=card(),compute=vi.fn(evaluate),derive=createWorkbenchDerivation(compute);derive(c);
  const changed=structuredClone(c);changed.abilities.str=18;changed.baseHp=40;
  expect(derive(changed)).toEqual(evaluate(changed));expect(derive(changed).maxHp).toBe(40);
  const incoming=structuredClone(changed);incoming.abilities.dex=18;expect(derive(incoming)).toEqual(evaluate(incoming));
  expect(compute).toHaveBeenCalledTimes(3);
 });
 it('uses the actual projected edition, profile and rule packs without reusing another room view',()=>{
  const c=card(),next=applyRuntimeCharacterEdit(c,runtimeValueEdit('hp',8))!,compute=vi.fn(evaluate),derive=createWorkbenchDerivation(compute);
  const profile={...c.profile,enabledSources:[]},packs:NonNullable<typeof c.rulePacks>=[];
  const first={...c,edition:'2014' as const,profile,rulePacks:packs};expect(derive(c,first)).toEqual(evaluate(first));
  expect(derive(next,{...first,runtime:next.runtime})).toEqual(evaluate({...first,runtime:next.runtime}));expect(compute).toHaveBeenCalledTimes(1);
  for(const view of [{...first,edition:'2024' as const},{...first,profile:{...profile}},{...first,rulePacks:[]}])expect(derive(c,view)).toEqual(evaluate(view));
  expect(compute).toHaveBeenCalledTimes(4);
 });
 it('does not cache a failed computation',()=>{
  const c=card(),compute=vi.fn(evaluate).mockImplementationOnce(()=>{throw Error('rule failure');}),derive=createWorkbenchDerivation(compute);
  expect(()=>derive(c)).toThrow('rule failure');expect(derive(c)).toEqual(evaluate(c));expect(compute).toHaveBeenCalledTimes(2);
 });
});
