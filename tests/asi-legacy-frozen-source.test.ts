import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {asiAllocationStatus,setAsiAllocation} from '../src/core/automation/asi';
import evidence from '../src/core/automation/legacyAsiEvidence.json';
import choicesEvidence from '../src/core/automation/classChoiceEvidence.json';
const directory=process.env.ASI_FROZEN_DIR;
it.skipIf(!directory).each(Object.entries(evidence.inputs))('verifies frozen %s legacy source profiles and actual class grants',(suffix,expected)=>{
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');let checked=0;
 expect(evidence.profiles.map(({owner,feature,level})=>({owner,feature,level}))).toEqual(choicesEvidence.legacyFeatChoices);
 expect(evidence.profiles).toHaveLength(68);
 {
  const row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(hash(data)).toBe(row.sha256);expect(hash(data)).toBe(expected);const entries=normalizeData(structuredClone(data),'legacy-frozen-exact');
  for(const profile of evidence.profiles){
   const owner=entries.find(e=>e.kind==='class'&&`${e.english}|${e.source}`===profile.owner);if(!owner)continue;
   const feature=data.classFeature.find((f:any)=>f.ENG_name==='Ability Score Improvement'&&f.source===owner.source&&f.className===owner.raw.name&&f.level===profile.level);expect(hash(feature)).toBe(profile.entryHash);
   const c=newCharacter();c.edition='2014';c.profile.enabledSources=[owner.source];c.automation=newAutomationState();c.selections=[{id:'actual-owner',entry:owner,level:profile.level,quantity:1,equipped:false}];syncFeatures(c,entries);
   const choice=sheetChoices(c,entries).find(x=>x.id.includes(':class-legacy-feat:')&&x.grantLevel===profile.level)!;expect(choice).toBeDefined();expect(evaluate(c).abilities.str).toBe(10);setSheetChoiceSlot(c,choice.id,0,choice.options.find(x=>x.entry.raw._classAbilityRecord)!.value,entries);expect(asiAllocationStatus(c,choice.id).eligible).toBe(true);setAsiAllocation(c,choice.id,{str:2});expect(evaluate(c).abilities.str).toBe(12);expect(c.abilities.str).toBe(10);checked++;
  }
 }
 expect(checked).toBeGreaterThan(0);
});
