import {it,expect} from 'vitest';
import {infusionFixture} from './e2e/infusionFixture';
import {enhancedWeaponFixture} from './e2e/enhancedWeaponFixture';
import {returningWeaponFixture} from './e2e/returningWeaponFixture';
import {arcaneFocusFixture} from './e2e/arcaneFocusFixture';
import {canActivateInfusion,setInfusionTarget} from '../src/core/automation/infusions';
import evidence from '../src/core/automation/infusionEvidence.json';
import {normalizeData} from '../src/data/catalog';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

it.each([
 ['defense',infusionFixture,'infusion-item-0'],
 ['enhanced weapon',enhancedWeaponFixture,'weapon-0'],
 ['returning weapon',returningWeaponFixture,'weapon-0'],
 ['arcane focus',arcaneFocusFixture,'focus-0'],
] as const)('rejects an unknown same-structure Infuse Item child impersonating the Chinese display label for %s',(_name,fixture,targetId)=>{
 const {c,entry,choiceId}=fixture(),grant=c.selections.find(row=>row.id==='infusion-feature')!;
 expect(canActivateInfusion(c,choiceId,entry.id)).toBe(true);
 grant.entry.english='Unreviewed Feature';grant.entry.raw.ENG_name='Unreviewed Feature';
 const before=JSON.stringify(c);expect(canActivateInfusion(c,choiceId,entry.id)).toBe(false);expect(()=>setInfusionTarget(c,choiceId,entry.id,targetId)).toThrow(/未有效学习/);expect(JSON.stringify(c)).toBe(before);
});

it.each(['grant-key','parent','english-case','display-reference'] as const)('does not substitute canonical English for the remaining %s authorization check',mode=>{
 const {c,entry,choiceId}=arcaneFocusFixture(),grant=c.selections.find(row=>row.id==='infusion-feature')!;
 if(mode==='grant-key')grant.grantKey='ref:Infuse Item|Artificer|TCE|2';
 if(mode==='parent')grant.parentId='unrelated-owner';
 if(mode==='english-case')grant.entry.english='infuse item';
 if(mode==='display-reference')grant.entry.name='Unreviewed Display Reference';
 const before=JSON.stringify(c);expect(canActivateInfusion(c,choiceId,entry.id)).toBe(false);expect(()=>setInfusionTarget(c,choiceId,entry.id,'focus-0')).toThrow(/未有效学习/);expect(JSON.stringify(c)).toBe(before);
});

const sourceDir=process.env.INFUSION_SOURCE_DIR;
it.skipIf(!sourceDir)('retains the exact frozen Chinese source reference and canonical Infuse Item English identity',()=>{
 const data=JSON.parse(readFileSync(`${sourceDir}/class-artificer-e2623b204ddbdf2bcfa8317acfc962de89c676e2.json`,'utf8')),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 expect(hash(data)).toBe(evidence.inputs['class/class-artificer.json']);const raw=data.classFeature.find((row:any)=>row.ENG_name==='Infuse Item'&&row.source==='TCE');expect(hash(raw)).toBe(evidence.entryHashes['Infuse Item|Artificer|TCE|2']);
 const entries=normalizeData(data,'frozen-infusion-child-identity'),{c,entry,choiceId}=arcaneFocusFixture(),owner=c.selections.find(row=>row.id==='infusion-owner')!,grant=c.selections.find(row=>row.id==='infusion-feature')!;
 owner.entry=entries.find(row=>row.kind==='class'&&row.english==='Artificer'&&row.source==='TCE')!;grant.entry=entries.find(row=>row.raw._category==='classFeature'&&row.english==='Infuse Item'&&row.source==='TCE')!;
 expect(grant.entry.english).toBe(evidence.classFeatureEnglish);expect(evidence.classFeatureEnglish).toBe('Infuse Item');expect(grant.entry.name).toBe('物品注法');expect(grant.grantKey).toBe(`ref:${evidence.classFeatureReference}`);expect(canActivateInfusion(c,choiceId,entry.id)).toBe(true);setInfusionTarget(c,choiceId,entry.id,'focus-0');expect(c.infusions!.bindings[0].targetId).toBe('focus-0');
});
