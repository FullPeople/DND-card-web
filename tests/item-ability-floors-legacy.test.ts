import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {editionAllows,selectionAllowed,selectionEffectsAllowed} from '../src/core/model';
import {activeEffectSelections} from '../src/core/automation/active';
import {itemAbilityFloorRule} from '../src/core/automation/itemAbilityFloors';
import {itemAbilityFloorEntries,itemAbilityFloorFixture,itemAbilityFloorDigest} from './helpers/itemAbilityFloorFixture';
beforeAll(()=>{itemAbilityFloorEntries();});
it('preserves the already-allowed real DMG2014 item route on a2024 character with explicit legacy enabled',()=>{
 const f=itemAbilityFloorFixture();f.c.edition='2024';f.c.profile.optional.legacy=true;const before=itemAbilityFloorDigest(f.c),snapshot=itemAbilityFloorDigest(f.entry);
 expect(editionAllows(f.entry,f.c.edition,true)).toBe(true);expect(selectionAllowed(f.c,f.entry)).toBe(true);expect(selectionEffectsAllowed(f.c,f.entry)).toBe(true);expect(activeEffectSelections(f.c)).toContain(f.owner);expect(itemAbilityFloorRule(f.entry)?.edition).toBe('2014');
 expect(evaluate(f.c).abilities.con).toBe(19);expect(itemAbilityFloorDigest(f.entry)).toBe(snapshot);expect(itemAbilityFloorDigest(f.c)).toBe(before);
});
it('legacy-disabled blocks new picks but does not revoke an existing source-enabled saved item effect',()=>{
 const f=itemAbilityFloorFixture();f.c.edition='2024';f.c.profile.optional.legacy=false;const before=itemAbilityFloorDigest(f.c);
 expect(editionAllows(f.entry,f.c.edition,false)).toBe(false);expect(selectionAllowed(f.c,f.entry)).toBe(false);expect(selectionEffectsAllowed(f.c,f.entry)).toBe(true);expect(activeEffectSelections(f.c)).toContain(f.owner);expect(evaluate(f.c).abilities.con).toBe(19);expect(itemAbilityFloorDigest(f.c)).toBe(before);
});
it('legacy enablement cannot bypass the live original source-off guard',()=>{
 const f=itemAbilityFloorFixture();f.c.edition='2024';f.c.profile.optional.legacy=true;f.c.profile.enabledSources=f.c.profile.enabledSources.filter(s=>s!=='DMG');const before=itemAbilityFloorDigest(f.c);
 expect(editionAllows(f.entry,f.c.edition,true)).toBe(true);expect(selectionAllowed(f.c,f.entry)).toBe(false);expect(selectionEffectsAllowed(f.c,f.entry)).toBe(false);expect(activeEffectSelections(f.c)).not.toContain(f.owner);expect(evaluate(f.c).abilities.con).toBe(10);expect(itemAbilityFloorDigest(f.c)).toBe(before);
});
