import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {asiRule,setAsiAllocation} from '../src/core/automation/asi';
import evidence from '../src/core/automation/asiEvidence.json';
const directory=process.env.ASI_FROZEN_DIR;
it.skipIf(!directory)('verifies frozen source canonical hashes and actual Fighter 4/6 repeatable ASI grants',()=>{
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 const data=Object.entries(evidence.inputs).map(([suffix,expected])=>{
  const row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const body=readFileSync(`${directory}/${row.path}`,'utf8');const parsed=JSON.parse(body);expect(hash(JSON.stringify(parsed))).toBe(row.sha256);expect(hash(JSON.stringify(parsed))).toBe(expected);return parsed;
 });
 const raw=data[0].feat.find((f:any)=>f.ENG_name===evidence.english&&f.source==='XPHB');expect(hash(JSON.stringify(raw))).toBe(evidence.entryHash);
 const entries=normalizeData({...data[1],...data[0]},'asi-frozen-exact'),feat=entries.find(e=>e.kind==='feat'&&e.english===evidence.english&&e.source==='XPHB')!;expect(asiRule(feat)).toBe(true);
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'real-fighter',entry:entries.find(e=>e.kind==='class'&&e.source==='XPHB')!,level:6,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(x=>x.id.includes(':class-typed-feat:'));expect(choices.map(c=>c.grantLevel)).toEqual([4,6]);
 for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncChoiceContent(c,entries);
 expect(evaluate(c).abilities.str).toBe(10);setAsiAllocation(c,choices[0].id,{str:2});setAsiAllocation(c,choices[1].id,{dex:1,con:1});expect(evaluate(c).abilities).toMatchObject({str:12,dex:11,con:11});expect(c.abilities.str).toBe(10);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));syncFeatures(reopened,[]);expect(evaluate(reopened).abilities.dex).toBe(11);reopened.automation!.enabled=false;expect(evaluate(reopened).abilities.dex).toBe(10);reopened.automation!.enabled=true;reopened.selections[0].level=4;syncFeatures(reopened,[]);expect(evaluate(reopened).abilities.dex).toBe(10);reopened.selections[0].level=6;syncFeatures(reopened,[]);expect(evaluate(reopened).abilities.dex).toBe(11);
 const intent=JSON.stringify(c.asiAllocations);c.selections[0].level=4;syncFeatures(c,entries);expect(evaluate(c).abilities.dex).toBe(10);c.selections[0].level=6;syncFeatures(c,entries);expect(evaluate(c).abilities.dex).toBe(11);expect(JSON.stringify(c.asiAllocations)).toBe(intent);
});
