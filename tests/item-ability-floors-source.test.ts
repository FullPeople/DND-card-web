import {beforeAll,expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import evidence from '../src/core/automation/itemAbilityFloorEvidence.json';
import {itemAbilityFloorRule} from '../src/core/automation/itemAbilityFloors';
import {evaluate} from '../src/core/engine';
import {itemAbilityFloorEntries,itemAbilityFloorFixture,itemAbilityFloorSpecs,itemAbilityFloorPin,itemAbilityFloorSnapshot,itemAbilityFloorDigest} from './helpers/itemAbilityFloorFixture';
beforeAll(()=>{itemAbilityFloorEntries();});
it('records body-free proof metadata from the complete installed normalization of original18',()=>{
 const rules=itemAbilityFloorEntries().map(entry=>{const spec=itemAbilityFloorSpecs.find(s=>s.english===entry.english)!;expect(entry.raw.reqAttune).toBe(true);expect(entry.raw.ability.static).toEqual({[spec.ability]:spec.floor});return {id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,revision:entry.revision,page:entry.page??null,category:entry.raw._category,inputLocator:`body.item[ENG_name=${entry.english};source=${entry.source}]`,ability:spec.ability,floor:spec.floor,requiresAttunement:true,fullNormalizedSnapshotSha256:itemAbilityFloorSnapshot(entry)};});
 expect(rules).toEqual(evidence.rules);
 expect(JSON.stringify(evidence)).not.toMatch(/\"(?:raw|entries|body|text|character|card)\"\s*:/);
 expect(rules).toHaveLength(18);expect(rules.filter(r=>r.source==='DMG')).toHaveLength(9);expect(rules.filter(r=>r.source==='XDMG')).toHaveLength(9);
 if(process.env.ITEM_ABILITY_FLOOR_RECORD_PROOF==='1')writeFileSync('.local-evidence/itemAbilityFloorEvidence.json',JSON.stringify({schemaVersion:1,scope:'exact18-native-worn-attuned-fixed-ability-floors',inputs:[itemAbilityFloorPin],wholeEntryCompletionCredit:0,rules},null,2)+'\n');
});
for(const source of ['DMG','XDMG'])for(const spec of itemAbilityFloorSpecs)it(`actual fixed floor ${source} ${spec.english}`,()=>{
 const {c,entry}=itemAbilityFloorFixture(spec.english,source),before=itemAbilityFloorDigest(c);expect(entry.raw.ability.static[spec.ability]).toBe(spec.floor);expect(evaluate(c).abilities[spec.ability]).toBe(spec.floor);expect(c.abilities[spec.ability]).toBe(10);expect(itemAbilityFloorDigest(c)).toBe(before);
 expect(itemAbilityFloorRule(entry)?.fullNormalizedSnapshotSha256).toBe(itemAbilityFloorSnapshot(entry));
 const canonical=entry.id;entry.id=`authored-alias:${source}:${spec.english}`;entry.revision='authored-transport-revision';expect(itemAbilityFloorRule(entry)?.id).toBe(canonical);expect(evaluate(c).abilities[spec.ability]).toBe(spec.floor);
 c.profile.disabledEntries=[canonical];expect(evaluate(c).abilities[spec.ability]).toBe(10);c.profile.disabledEntries=[entry.id];expect(evaluate(c).abilities[spec.ability]).toBe(10);
});
