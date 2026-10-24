import {it,expect} from 'vitest';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {infusionRule,infusionTargets} from '../src/core/automation/infusions';

it('recognizes Mind Sharpener as a reviewed charge mechanism rather than default AC',()=>{
 const {infusion}=infusionChargesFixture('Mind Sharpener');
 expect(infusionRule(infusion)?.mechanism).toBe('concentration-reaction');
});
it('offers worn-armor or canonical PHB Robes candidates for Mind Sharpener',()=>{
 const {c,infusion}=infusionChargesFixture('Mind Sharpener');
 expect(infusionTargets(c,infusion).map(row=>row.id)).toEqual(['armor','robes']);
});
it('provides a separate initialization, reaction charge and dawn action domain',async()=>{
 const modules=import.meta.glob('../src/core/automation/infusionCharges.ts');
 expect(Object.keys(modules)).toHaveLength(1);
 const api=await Object.values(modules)[0]() as Record<string,unknown>;
 for(const name of ['infusionChargeOffer','infusionChargeActionRequest','performInfusionChargeAction'])expect(api[name]).toBeTypeOf('function');
});
