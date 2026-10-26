import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const hashes={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03'};
function input(suffix:string,expected:string){const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(expected);return data;}
function setup(){
 const entries=Object.entries(hashes).flatMap(([suffix,expected])=>normalizeData(input(suffix,expected),'reviewed-skilled-frozen'));
 const c=newCharacter('2014');c.profile.enabledSources=['PHB'];c.automation=newAutomationState();c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-skilled']={current:2,max:5};
 c.selections=[{id:'wizard',entry:entries.find(e=>e.kind==='class'&&e.english==='Wizard'&&e.source==='PHB')!,level:4,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(x=>x.id.includes(':class-legacy-feat:')&&x.grantLevel===4)!,feat=entries.find(e=>e.kind==='feat'&&e.english==='Skilled'&&e.source==='PHB')!;
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(c.selections.some(row=>row.entry.kind==='feat')).toBe(false);
 const source=c.selections.find(row=>row.parentId==='wizard'&&row.entry.id===choice.id.split(':class-legacy-feat:')[1])!;
 return {c,entries,choice,feat,source};
}
it.skipIf(!directory)('real frozen Wizard ASI4 explicitly confirmed Skilled mixed three grants Perception once without rewriting manual fields',()=>{
 const {c,choice,feat,source}=setup();expect(evaluate(c).skills.perception.value).toBe(0);
 (c as any).reviewedSkilled={version:1,bindings:[{selectionId:source.id,choiceId:choice.id,entryId:feat.id,intent:{kind:'skilled',choices:[{kind:'skill',reference:'perception'},{kind:'tool',reference:"Thieves' Tools|PHB"},{kind:'tool',reference:'Vehicles (Land)|PHB'}],confirmed:true}}]};
 const before=JSON.stringify(c),derived=evaluate(c);expect(derived.skills.perception).toMatchObject({value:2,proficient:true,expertise:false});expect(derived.passive).toBe(12);expect(JSON.stringify(c)).toBe(before);expect(c.runtime).toMatchObject({hp:7,tempHp:3,resources:{'manual-skilled':{current:2,max:5}}});
});

import evidence from '../src/core/automation/reviewedSkilledEvidence.json';
import legacyEvidence from '../src/core/automation/legacyAsiEvidence.json';
import {reviewedSkilledRule,reviewedSkilledOptions,reviewedSkilledReference,reviewedSkilledStatus,setReviewedSkilledIntent,evaluateReviewedSkilled} from '../src/core/automation/reviewedSkilled';
import {reviewedSkilledIdentity} from '../src/core/automation/reviewedFeatIdentity';
import {validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
const intent={kind:'skilled' as const,choices:[{kind:'skill' as const,reference:'perception'},{kind:'tool' as const,reference:"Thieves' Tools|PHB"},{kind:'tool' as const,reference:'Vehicles (Land)|PHB'}],confirmed:true as const};
it.skipIf(!directory)('all 55 concrete PHB source hashes and normalized identities match the finite 57-kind registry with two table-backed vehicle kinds',()=>{
 const bodies=Object.fromEntries(Object.entries(evidence.inputs).map(([path,hash])=>[path,input(path,hash)]));
 const entries=Object.values(bodies).flatMap(body=>normalizeData(body,'skilled-source-registry')),c=newCharacter('2014');c.profile.enabledSources=['PHB'];
 const options=reviewedSkilledOptions(c,entries);expect(options).toHaveLength(57);expect(options.every(row=>!row.unavailable)).toBe(true);
 for(const rule of [...evidence.skills,...evidence.tools]){
  const path=rule.category==='skill'?'skills.json':rule.category==='baseitem'?'items-base.json':'items.json',raw=bodies[path][rule.category].find((value:any)=>value.ENG_name===rule.english&&value.source==='PHB');
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex'),rule.reference).toBe(rule.entryHash);expect(Object.keys(raw),rule.reference).toEqual(rule.rawKeys);
  const entry=entries.find(row=>row.id===rule.entryId)!;expect(entry,rule.reference).toBeDefined();expect(entry.edition).toBe('2014');expect(reviewedSkilledReference(entry)).toEqual({kind:rule.category==='skill'?'skill':'tool',reference:rule.reference});
 }
 const raw=bodies['feats.json'].feat.find((row:any)=>row.ENG_name==='Skilled'&&row.source==='PHB');expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex')).toBe(evidence.feat.entryHash);expect(entries.find(row=>row.id===evidence.feat.entryId)).toBeDefined();
 expect(evidence.tools.filter(row=>row.mechanics.type==='AT')).toHaveLength(17);expect(evidence.tools.filter(row=>row.mechanics.type==='INS')).toHaveLength(10);expect(evidence.tools.filter(row=>row.mechanics.type==='GS')).toHaveLength(4);expect(evidence.tools.filter(row=>row.mechanics.type==='T')).toHaveLength(6);
 expect(options.filter(row=>row.choice.reference.includes('Vehicles'))).toHaveLength(2);expect(entries.filter(row=>row.edition==='2024').every(row=>!reviewedSkilledReference(row))).toBe(true);
});
it.skipIf(!directory)('all 68 reviewed PHB/TCE source ASI positions authenticate real frozen owner chains and preserve earned proficiency after reopening',()=>{
 const feats=normalizeData(input('feats.json',hashes['feats.json']),'skilled-feat'),feat=feats.find(row=>row.english==='Skilled'&&row.source==='PHB')!;
 const classes=Object.fromEntries(Object.entries(legacyEvidence.inputs).map(([path,hash])=>[path,normalizeData(input(path,hash),'skilled-legacy-source')]));let checked=0;
 for(const profile of legacyEvidence.profiles){
  const [english,source]=profile.owner.split('|'),entries=[...classes[`class/class-${english.toLowerCase()}.json`],feat],owner=entries.find(row=>row.kind==='class'&&row.english===english&&row.source===source)!;
  const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','TCE'];c.selections=[{id:'source-owner',entry:owner,level:profile.level,quantity:1,equipped:false}];syncFeatures(c,entries);
  const choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-legacy-feat:')&&row.grantLevel===profile.level)!;expect(choice,profile.feature).toBeDefined();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedSkilledIntent(c,choice.id,feat.id,intent);expect(reviewedSkilledStatus(c,choice.id,feat.id).active,profile.feature).toBe(true);
  expect(evaluate(c).skills.perception.value,profile.feature).toBe(2+Math.floor((profile.level-1)/4));expect(evaluateReviewedSkilled(c).tools).toEqual(["Thieves' Tools|PHB",'Vehicles (Land)|PHB']);const restored=validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));syncFeatures(restored,[]);expect(reviewedSkilledStatus(restored,choice.id,feat.id).active,profile.feature).toBe(true);checked++;
 }
 expect(checked).toBe(68);
});
it.skipIf(!directory)('actual repeatable XPHB Skilled keeps its separate identity and is never a PHB confirmation or deny-family match',()=>{
 const {c,entries}=setup(),modern=entries.find(row=>row.english==='Skilled'&&row.source==='XPHB')!;expect(modern.raw.category).toBe('O');expect(modern.raw.repeatable).toBe(true);expect(modern.raw.repeatableHidden).toBe(true);expect(reviewedSkilledRule(modern)).toBeUndefined();expect(reviewedSkilledIdentity(modern)).toBe(false);
 c.edition='2024';c.profile.enabledSources=['XPHB'];c.selections=[{id:'modern-skilled',entry:modern,level:1,quantity:1,equipped:false}];expect(evaluateReviewedSkilled(c).skills).toEqual([]);expect(evaluateReviewedSkilled(c).tools).toEqual([]);expect(c.reviewedSkilled).toBeUndefined();
});
