import {expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {ABILITIES} from '../src/core/model';
import {itemPassiveBonusFixture} from './helpers/itemPassiveBonusFlowFixture';
import {itemPassiveBonusSpecs,itemPassiveBonusSnapshot} from './helpers/itemPassiveBonusSourceFixture';
// Existing actual consumer imports: these sixteen failures must demonstrate the
// missing rule capability, never an absent new projection module or stub API.
for(const spec of itemPassiveBonusSpecs)it(`real source passive derived values ${spec.source}:${spec.english}`,()=>{
 const f=itemPassiveBonusFixture(spec.sourceIndex),off=structuredClone(f.c);off.selections[0].attuned=false;const before=itemPassiveBonusSnapshot(f.c),baseline=evaluate(off),actual=evaluate(f.c);
 expect(actual.ac-baseline.ac).toBe(spec.acBonus);for(const ability of ABILITIES)expect(actual.saves[ability].value-baseline.saves[ability].value).toBe(spec.saveBonuses[ability]||0);
 expect(itemPassiveBonusSnapshot(f.c)).toBe(before);
});
