import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import evidence from '../src/core/automation/sourceLevelHpEvidence.json';
import {sourceLevelHpRequest,performSourceLevelHpAction} from '../src/core/automation/sourceLevelHp';
import {sourceLevelHpFixture} from './helpers/sourceLevelHpFlowFixture';
import {sourceLevelHpSourceEvidence,sourceLevelHpSnapshot as snapshot} from './helpers/sourceLevelHpSourceFixture';

beforeAll(()=>{sourceLevelHpSourceEvidence();},30000);
// Genuine current evaluate(c) assertions. The disconnected actor records ONLY
// explicit exclusion consent, never a fabricated effect or granted HP value.
for(const rule of evidence.rules)it(`actual acknowledged per-level maximum HP ${rule.key}`,()=>{
 for(const form of ['canonical','app']as const){const f=sourceLevelHpFixture(rule.key,form),request=sourceLevelHpRequest(f.c,f.owner.id,'authored-baseline-'+rule.key+'-'+form,{kind:'confirm',confirmedManualHpExcluded:true}),runtime=snapshot(f.c.runtime);expect(performSourceLevelHpAction(f.c,request,{canEdit:true,gm:false}).status).toBe('applied');expect(snapshot(f.c.runtime)).toBe(runtime);const native=JSON.stringify(f.c),before=snapshot(f.c),d=evaluate(f.c),level=rule.levelBasis==='character-level'?d.level:f.classOwner.level;expect(d.level).toBe(7);expect(d.modifiers.con).toBe(2);expect.soft(d.maxHp).toBe(40+level+2);expect(JSON.stringify(f.c)).toBe(native);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
it('does not grant an unconfirmed source benefit and leaves manual-final plus independent offset in its established order',()=>{
 for(const rule of evidence.rules){const f=sourceLevelHpFixture(rule.key);expect(evaluate(f.c).maxHp).toBe(42);f.c.adjustments=[{id:'authored-final-hp',target:'hp',value:29,reason:'Authored manual final HP'}];const native=JSON.stringify(f.c);expect(evaluate(f.c).maxHp).toBe(31);expect(JSON.stringify(f.c)).toBe(native);}
});
