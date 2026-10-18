import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {applyRuntimeCharacterEdit,resourceBalanceEdit,runtimeValueEdit,runtimeCharacterBase} from '../src/core/runtimeCharacterEdit';
import {syncAutoResources,setResource} from '../src/core/resources';
import {rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw});
function card(){const c=newCharacter();c.automation=newAutomationState();c.selections=[
 {id:'owner',entry:entry('Authored caster','class',{casterProgression:'full',hd:{faces:8}}),quantity:1,equipped:false,level:3},
 {id:'feature',parentId:'owner',entry:entry('Authored resource','feature',{resources:[{name:'Authored reserve',max:3,recovery:'long'}]}),quantity:1,equipped:false,level:1},
 ];c.runtime.resources.manual={current:2,max:8};syncAutoResources(c);return c;}
describe('explicit runtime balances',()=>{
 it.each(['hp','tempHp'] as const)('%s edits preserve old snapshots and share construction data',field=>{
  const c=card(),old=structuredClone(c),next=applyRuntimeCharacterEdit(c,runtimeValueEdit(field,7))!;
  expect(next.runtime[field]).toBe(7);expect(c).toEqual(old);expect(next.selections).toBe(c.selections);expect(next.profile).toBe(c.profile);expect(next.runtime.resources).toBe(c.runtime.resources);
  expect(evaluate(next)).toEqual(evaluate(c));expect(runtimeCharacterBase(next)).toBe(c);
  const later=applyRuntimeCharacterEdit(next,runtimeValueEdit(field,8))!;expect(runtimeCharacterBase(later)).toBe(c);expect(next.runtime[field]).toBe(7);
 });
 it.each(['manual','hit-die:8','spell-slot:1','pact-slot:2','feature'])('keeps %s balance and ledgers identical to the ordinary resource setter',kind=>{
  const c=card();c.runtime.resources['pact-slot:2']={current:2,max:2};const id=kind==='feature'?Object.keys(c.runtime.resources).find(key=>c.runtime.resources[key].featureGrant)!:kind;
  const old=structuredClone(c),expected=structuredClone(c);rememberSourceSpellUses(expected);setResource(expected,id,1);rememberSourceSpellUses(expected);
  const next=applyRuntimeCharacterEdit(c,resourceBalanceEdit(id,1))!;expect(next).toEqual(expected);expect(c).toEqual(old);
  expect(next.selections).toBe(c.selections);expect(next.runtime.resources[id]).not.toBe(c.runtime.resources[id]);
  if(kind==='spell-slot:1'){expect(next.spellSettings?.slots['1'].used).toBe(3);expect(c.spellSettings?.slots['1'].used).toBe(0);}
  expect(validateCharacter(exportCharacter(next)).runtime.resources[id].current).toBe(1);
 });
 it('updates shared source-use debt without altering the previous ledger',()=>{
  const c=card();c.runtime.resources['source-spell-pool:authored']={current:2,max:2};
  c.spellSettings!.special={spell:{mode:'uses',max:2,sourceGrant:{ownerId:'owner',active:true,usageKey:'use-key',resourceKey:'source-spell-pool:authored'}} as any};
  c.runtime.sourceSpellSpent={'use-key':0};const next=applyRuntimeCharacterEdit(c,resourceBalanceEdit('source-spell-pool:authored',0))!;
  expect(next.runtime.sourceSpellSpent!['use-key']).toBe(2);expect(c.runtime.sourceSpellSpent!['use-key']).toBe(0);
  expect(applyRuntimeCharacterEdit(next,resourceBalanceEdit('source-spell-pool:authored',1))!.runtime.sourceSpellSpent!['use-key']).toBe(1);
 });
 it('clamps finite pools, preserves unlimited values and does not recreate deleted resources',()=>{
  const c=card();expect(applyRuntimeCharacterEdit(c,resourceBalanceEdit('manual',99))!.runtime.resources.manual.current).toBe(8);
  expect(applyRuntimeCharacterEdit(c,resourceBalanceEdit('manual',-99))!.runtime.resources.manual.current).toBe(0);
  c.runtime.resources.manual.unlimited=true;expect(applyRuntimeCharacterEdit(c,resourceBalanceEdit('manual',99))!.runtime.resources.manual.current).toBe(99);
  expect(applyRuntimeCharacterEdit(c,resourceBalanceEdit('deleted',1))).toBe(c);
 });
 it('does not opt out ordinary callbacks, uninitialized, future-protocol or legacy casting cards',()=>{
  const c=card();expect(applyRuntimeCharacterEdit(c,d=>{d.baseHp=99;})).toBeUndefined();
  for(const altered of [{...c,automation:undefined},{...c,automation:{...c.automation!,protocol:99}}])expect(applyRuntimeCharacterEdit(altered,runtimeValueEdit('hp',2))).toBeUndefined();
  c.selections[0].entry={...c.selections[0].entry,packId:'imported',source:'IMPORTED'};expect(applyRuntimeCharacterEdit(c,runtimeValueEdit('hp',2))).toBeUndefined();
  expect(applyRuntimeCharacterEdit(card(),runtimeValueEdit('hp',NaN))).toBeUndefined();
 });
 it('a later normal build edit invalidates the construction identity and still recomputes slots',()=>{
  const c=card(),next=applyRuntimeCharacterEdit(c,resourceBalanceEdit('spell-slot:1',1))!,changed=structuredClone(next);
  changed.selections[0].level=4;syncAutoResources(changed,next);expect(runtimeCharacterBase(changed)).toBe(changed);expect(changed.runtime.resources['spell-slot:2'].max).toBe(3);
  expect(changed.runtime.resources['spell-slot:1'].current).toBe(1);
 });
 it('repeated no-op balances do not create a new snapshot',()=>{const c=card();expect(applyRuntimeCharacterEdit(c,runtimeValueEdit('hp',0))).toBe(c);expect(applyRuntimeCharacterEdit(c,resourceBalanceEdit('manual',2))).toBe(c);});
});
