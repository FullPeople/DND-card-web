import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {validateCharacter,validatePack,EXAMPLE_PACK} from '../src/core/validation';
describe('portable workbench rules',()=>{
 it('retains normalized custom rule packs and disabled choices through a character round trip',()=>{
  const c=newCharacter(),pack=validatePack(EXAMPLE_PACK,[]);c.rulePacks=[pack];c.profile.enabledSources.push(pack.id);c.profile.disabledEntries=[pack.entries[0].id];
  c.quickbarLayout={order:['resource:hit-die:6','weapon:0:短剑'],hidden:['pin:old']};
  const loaded=validateCharacter(JSON.parse(JSON.stringify(c)));
  expect(loaded.rulePacks).toEqual([pack]);expect(loaded.profile).toEqual(c.profile);expect(loaded.quickbarLayout).toEqual(c.quickbarLayout);
 });
 it('rejects malformed custom packs before accepting remote character data',()=>{
  const c=newCharacter();c.rulePacks=[{...validatePack(EXAMPLE_PACK,[]),entries:[{name:'invalid'} as any]}];expect(()=>validateCharacter(c)).toThrow();
 });
});
