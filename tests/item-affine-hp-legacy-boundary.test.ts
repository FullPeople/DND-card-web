import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import {itemAffineHpFamilyId,itemAffineHpLegacyHpSelection,itemAffineHpOffer,itemAffineHpRule,projectItemAffineHp} from '../src/core/automation/itemAffineHp';
import {itemAffineHpFixture} from './helpers/itemAffineHpFlowFixture';
import {itemAffineHpSpecs,itemAffineHpSourceEvidence,itemAffineHpSnapshot as snapshot} from './helpers/itemAffineHpSourceFixture';

beforeAll(()=>{itemAffineHpSourceEvidence();},30000);
// Actual engine boundary, not a projection-only assertion. A changed recognized
// source cannot recover its rejected maximum-HP branch via the old generic flat
// effect executor. Recognition holds this exact source namespace; it grants no HP.
for(const route of ['canonical','transport-alias']as const)it(`rejected ${route} source payload cannot bypass complete item HP proof through legacy flat effects`,()=>{
 for(const form of ['canonical','app']as const)for(const spec of itemAffineHpSpecs){
  const f=itemAffineHpFixture(spec.key,form),canonical=f.entry.id;if(route==='transport-alias'){f.entry.id='authored-review-item-alias';f.entry.revision='authored-current-transport';}
  f.entry.effects=[{op:'add',target:'hp',value:99}];expect(itemAffineHpFamilyId(f.entry)).toBe(canonical);expect(itemAffineHpRule(f.entry)).toBeUndefined();expect(itemAffineHpLegacyHpSelection(f.c,f.owner)).toBe(true);expect(itemAffineHpOffer(f.c,f.owner.id,{canEdit:true,gm:false})?.canConfirm).toBe(false);expect(projectItemAffineHp(f.c).bonus).toBe(0);
  const before=snapshot(f.c),d=evaluate(f.c);expect.soft(d.maxHp).toBe(42);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
 }
});
it('bounded source exclusion leaves genuine CUSTOM same-name and unrelated generic item HP executors positive',()=>{
 for(const kind of ['feature','item']as const){const f=itemAffineHpFixture(),entry=createCustomEntry({type:kind,name:f.entry.name,english:f.entry.english,body:''}),row={id:'authored-custom-boundary-'+kind,entry,quantity:1,level:1,equipped:false};entry.effects=[{op:'add',target:'hp',value:3}];f.c.selections.push(row);expect(itemAffineHpFamilyId(entry)).toBeUndefined();expect(itemAffineHpLegacyHpSelection(f.c,row)).toBe(false);const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(45);expect(snapshot(f.c)).toBe(before);}
 const f=itemAffineHpFixture(),entry=createCustomEntry({type:'item',name:'Authored unrelated generic manual HP item',body:''}),row={id:'authored-generic-boundary',entry,quantity:1,level:1,equipped:false};entry.id='authored:independent-generic:item';entry.packId='authored';entry.source='DMG';entry.effects=[{op:'set',target:'hp',value:27}];f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,'DMG'])];f.c.selections.push(row);expect(itemAffineHpLegacyHpSelection(f.c,row)).toBe(false);const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(29);expect(snapshot(f.c)).toBe(before);
});
