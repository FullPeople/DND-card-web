import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import {itemAffineHpRequest,performItemAffineHpAction} from '../src/core/automation/itemAffineHp';
import {itemAffineHpFixture} from './helpers/itemAffineHpFlowFixture';
import {itemAffineHpSpecs,itemAffineHpSourceEvidence,itemAffineHpSnapshot as snapshot} from './helpers/itemAffineHpSourceFixture';

beforeAll(()=>{itemAffineHpSourceEvidence();},30000);
// Genuine RED on the frozen published evaluate(c), before an engine bridge.
// The disconnected actor records explicit exclusion consent only; neither it
// nor these fixtures injects a legacy HP effect or a precomputed granted value.
for(const spec of itemAffineHpSpecs)it(`actual item-owned affine maximum HP ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){const f=itemAffineHpFixture(spec.key,form),request=itemAffineHpRequest(f.c,f.owner.id,'authored-baseline-'+spec.key+'-'+form,{kind:'confirm',confirmedManualHpExcluded:true}),runtime=snapshot(f.c.runtime);expect(performItemAffineHpAction(f.c,request,{canEdit:true,gm:false}).status).toBe('applied');expect(snapshot(f.c.runtime)).toBe(runtime);const before=snapshot(f.c),d=evaluate(f.c);expect(d.level).toBe(7);expect(d.modifiers.con).toBe(2);expect.soft(d.maxHp).toBe(42+f.rule.constant+7);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
it('unconfirmed source HP is not granted and manual-final HP retains its independent offset',()=>{
 for(const spec of itemAffineHpSpecs){const f=itemAffineHpFixture(spec.key);expect(evaluate(f.c).maxHp).toBe(42);f.c.adjustments=[{id:'authored-final',target:'hp',value:29,reason:'Authored retained final HP'}];const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(31);expect(snapshot(f.c)).toBe(before);}
});
it('positive unrelated CUSTOM feature/item and generic manual item HP paths remain functional',()=>{
 for(const kind of ['feature','item']as const){const f=itemAffineHpFixture(),entry=createCustomEntry({type:kind,name:f.entry.name,english:f.entry.english,body:''});entry.effects=[{op:'add',target:'hp',value:3}];f.c.selections.push({id:'authored-custom-'+kind,entry,quantity:1,level:1,equipped:false,attuned:true});const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(45);expect(snapshot(f.c)).toBe(before);}
 const f=itemAffineHpFixture(),entry=createCustomEntry({type:'item',name:'Authored independent generic manual item',body:''});entry.id='authored:generic:item:hp';entry.packId='authored';entry.source='PHB';entry.effects=[{op:'set',target:'hp',value:27}];f.c.profile.enabledSources.push('PHB');f.c.selections.push({id:'authored-generic-item',entry,quantity:1,level:1,equipped:false});const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(29);expect(snapshot(f.c)).toBe(before);
});
