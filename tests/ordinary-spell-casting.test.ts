import {it,expect} from 'vitest';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {ordinarySpellFixture,ordinarySnapshot} from './helpers/ordinarySpellCastingFixture';
import {readCharacter} from '../src/core/validation';
it.each(['Wizard','Sorcerer','Warlock'] as const)('fresh real %s owned readiness offers ordinary casting, atomically spends and persists without refills',caster=>{
 const {c,row}=ordinarySpellFixture({caster}),before=ordinarySnapshot(c),offer=spellPayments(c,row.id),option=offer.options.find(o=>o.id.startsWith('ordinary:'));
 expect(ordinarySnapshot(c)).toBe(before);expect(option).toBeDefined();expect(option!.available).toBe(true);const manual=ordinarySnapshot(c.runtime.resources.manual),pool=c.runtime.resources[option!.resourceId!],remaining=pool.current;
 const request=spellActionRequest(c,row.id,option!.id,'fresh-real-cast');expect(performSpellAction(c,request).status).toBe('applied');expect(pool.current).toBe(remaining-1);expect(performSpellAction(c,request).status).toBe('duplicate');expect(pool.current).toBe(remaining-1);expect(ordinarySnapshot(c.runtime.resources.manual)).toBe(manual);expect(readCharacter(JSON.parse(JSON.stringify(c))).character.runtime.resources).toEqual(c.runtime.resources);
});
it('fresh real explicitly chosen cantrip casts without a slot debit',()=>{const {c,row}=ordinarySpellFixture({cantrip:true}),resources=ordinarySnapshot(c.runtime.resources),option=spellPayments(c,row.id).options.find(o=>o.id==='ordinary:cantrip');expect(option).toBeDefined();expect(performSpellAction(c,spellActionRequest(c,row.id,option!.id,'fresh-cantrip')).status).toBe('applied');expect(ordinarySnapshot(c.runtime.resources)).toBe(resources);});
