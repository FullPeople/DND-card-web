import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import type {Entry} from '../src/core/model';
import {projectRacialMovement,racialMovementRule,racialMovementSnapshot} from '../src/core/automation/racialMovement';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import evidence from '../src/core/automation/racialMovementEvidence.json';
import {racialMovementDigest,racialMovementEntries,racialMovementFixture,racialMovementHeldSpecs,racialMovementSpecs} from './helpers/racialMovementFixture';
import {relativeRacialMovementRule} from '../src/core/automation/relativeRacialMovement';
import {relativeRacialMovementSpecs} from './helpers/relativeRacialMovementSourceFixture';

beforeAll(()=>{racialMovementEntries();});
it('binds fresh complete source forms and declares per-row mechanism credit without whole-entry completion',()=>{
 expect(evidence.rules).toHaveLength(12);expect(evidence.held).toEqual(racialMovementHeldSpecs);expect(evidence.held).toHaveLength(32);expect(evidence.unreviewedHomebrewCount).toBe(18);expect(evidence.wholeEntryCompletionCredit).toBe(0);expect(evidence.newWitnessCredit).toBe(0);
 for(const entry of racialMovementEntries()){const rule=evidence.rules.find(row=>row.id===entry.id)!;expect(rule).toBeDefined();expect(racialMovementSnapshot(entry)).toBe(rule.fullNormalizedSnapshotSha256);expect(rule.firstPassMechanism).toBe('source-base-fixed-movement-only');expect(rule.wholeEntryCompletion).toBe(false);expect(rule.remainingWholeEntryGaps.length).toBeGreaterThan(0);}
 const prohibited=(value:unknown):boolean=>!!value&&typeof value==='object'&&(Array.isArray(value)?value.some(prohibited):Object.entries(value).some(([key,child])=>['raw','entries','body','text','character','card'].includes(key)||prohibited(child)));expect(prohibited(evidence)).toBe(false);
});
it('withdraws and resumes on live automation, source and exclusion state without rewriting stored data',()=>{
 const f=racialMovementFixture();
 for(const mode of ['automation','protocol','source','excluded'] as const){
  const c=structuredClone(f.c);if(mode==='automation')c.automation!.enabled=false;if(mode==='protocol')c.automation!.protocol=999;if(mode==='source')c.profile.enabledSources=[];
  const saved=racialMovementDigest(c),derived=evaluate(c,mode==='excluded'?new Set([f.owner.id]):undefined);expect(derived.sourceMovement,mode).toBeUndefined();expect(derived.issues.some(issue=>issue.id.startsWith('racial-movement:')),mode).toBe(true);expect(racialMovementDigest(c)).toBe(saved);
 }
 expect(evaluate(f.c).sourceMovement).toEqual({swim:30});f.c.edition='2024';f.c.profile.optional.legacy=false;const saved=racialMovementDigest(f.c);expect(evaluate(f.c).sourceMovement).toEqual({swim:30});expect(racialMovementDigest(f.c)).toBe(saved);
});
it('checks every exact inherited/copy parent SOURCE, without requiring separately selected parents or transitive parent IDs',()=>{
 for(const spec of racialMovementSpecs){for(const source of spec.requiredSources){const f=racialMovementFixture(spec.id);expect(f.c.selections).toHaveLength(1);expect(evaluate(f.c).sourceMovement).toEqual({[spec.mode]:spec.baseFeet});f.c.profile.enabledSources=f.c.profile.enabledSources.filter(value=>value!==source);f.c.profile.exceptions[f.entry.id]='Authored generic exception';const saved=racialMovementDigest(f.c);expect(evaluate(f.c).sourceMovement,spec.id+':'+source).toBeUndefined();expect(racialMovementDigest(f.c)).toBe(saved);}}
 const f=racialMovementFixture('kiwee:race:mot:triton::::::');f.c.profile.disabledEntries=['kiwee:race:vgm:triton::::::'];expect(evaluate(f.c).sourceMovement).toEqual({swim:30});
});
it('authenticates only full coherent unreserved aliases and obeys both canonical and alias disables',()=>{
 for(const disable of ['canonical','alias'] as const){const f=racialMovementFixture(),canonical=f.entry.id;f.entry.id='authored-coherent-movement-alias';f.entry.revision='authored-transport-revision';expect(racialMovementRule(f.entry)?.id).toBe(canonical);expect(evaluate(f.c).sourceMovement).toEqual({swim:30});f.c.profile.disabledEntries=[disable==='canonical'?canonical:f.entry.id];expect(evaluate(f.c).sourceMovement).toBeUndefined();}
 const f=racialMovementFixture();f.entry.id=f.entries.find(entry=>entry.kind==='race'&&entry.english==='Human'&&entry.source==='PHB')!.id;expect(racialMovementRule(f.entry)).toBeUndefined();expect(evaluate(f.c).sourceMovement).toBeUndefined();
});
it('denies complete snapshot/header corruption without repairing raw sources or quarantining unrelated manual mechanics',()=>{
 const mutations:((entry:Entry)=>void)[]=[entry=>{entry.id=' ';},entry=>{entry.id='x'.repeat(2001);},entry=>{entry.revision=' ';},entry=>{entry.revision='x'.repeat(4001);},entry=>{entry.kind='feature';},entry=>{entry.packId='authored';},entry=>{entry.source='XPHB';},entry=>{entry.edition='2024';},entry=>{entry.name+=' authored';},entry=>{entry.english+=' authored';},entry=>{entry.page=999;},entry=>{entry.raw._category='monster';},entry=>{entry.raw.speed.swim=999;},entry=>{entry.raw.extra=true;},entry=>{entry.entries.push('Authored extra clause');},entry=>{entry.dependencies=['AUTHORED'];},entry=>{entry.raw._copy={};},entry=>{entry.raw._unresolvedParent=true;},entry=>{entry.effects=[{op:'add',target:'ac',value:2}];},entry=>{(entry as any).raw=[];},entry=>{(entry as any).entries={authored:true};}];
 for(const mutate of mutations){const f=racialMovementFixture();mutate(f.entry);const saved=racialMovementDigest(f.c);expect(racialMovementRule(f.entry)).toBeUndefined();expect(projectRacialMovement(f.c).modes).toEqual({});expect(racialMovementDigest(f.c)).toBe(saved);}
 const f=racialMovementFixture();f.c.adjustments=[];f.c.sheetBonuses={};f.entry.raw.speed.swim=999;f.entry.effects=[{op:'add',target:'ac',value:2}];expect(evaluate(f.c).sourceMovement).toBeUndefined();expect(evaluate(f.c).ac).toBe(12);
});
it('requires one exact quantity1 complete root, and supplied active subsets can exclude but never authorize substitutes',()=>{
 for(const mode of ['quantity','child','duplicate','second-race'] as const){const f=racialMovementFixture();if(mode==='quantity')f.owner.quantity=2;if(mode==='child')f.owner.parentId=f.owner.id;if(mode==='duplicate')f.c.selections.push(structuredClone(f.owner));if(mode==='second-race')f.c.selections.push({...structuredClone(f.owner),id:'second-race-owner'});const saved=racialMovementDigest(f.c);expect(projectRacialMovement(f.c,[f.owner]).modes,mode).toEqual({});expect(racialMovementDigest(f.c)).toBe(saved);}
 const f=racialMovementFixture();expect(projectRacialMovement(f.c,[]).modes).toEqual({});expect(projectRacialMovement(f.c,[structuredClone(f.owner)]).modes).toEqual({});
});
it('does not reinterpret walking totals, scalar offsets, generic speed effects or notes as source movement modifiers',()=>{
 const f=racialMovementFixture(),effect:Entry={id:'authored-speed-effect',kind:'feature',name:'Authored scalar speed adjustment',english:'Authored scalar speed adjustment',source:'CUSTOM',edition:'both',packId:'custom',revision:'authored',entries:[],raw:{_custom:true},effects:[{op:'add',target:'speed',value:7}]};
 f.c.profile.enabledSources.push('CUSTOM');f.c.selections.push({id:'authored-effect-owner',entry:effect,quantity:1,level:1,equipped:false});let saved=racialMovementDigest(f.c);expect(evaluate(f.c).speed).toBe(50);expect(evaluate(f.c).sourceMovement).toEqual({swim:30});expect(racialMovementDigest(f.c)).toBe(saved);
 f.c.adjustments=[];saved=racialMovementDigest(f.c);expect(evaluate(f.c).speed).toBe(40);expect(evaluate(f.c).sourceMovement).toEqual({swim:30});expect(racialMovementDigest(f.c)).toBe(saved);expect(evaluate(f.c).trace.sourceMovement.join('；')).toMatch(/基础|手工/);
});
it('keeps twenty-six unresolved primary holds strict while six independently source-proven relations use only the current-walking route',()=>{
 const qualified=new Map(relativeRacialMovementSpecs.map(spec=>[spec.id,spec])),seen=new Set<string>();let unresolved=0;expect(qualified.size).toBe(6);expect(racialMovementHeldSpecs).toHaveLength(32);
 for(const held of racialMovementHeldSpecs){const f=racialMovementFixture(),matches=f.entries.filter(entry=>entry.id===held.id);expect(matches,held.id).toHaveLength(1);f.owner.entry=structuredClone(matches[0]);f.c.profile.enabledSources=[...new Set([f.owner.entry.source,...(f.owner.entry.dependencies||[])])];const saved=racialMovementDigest(f.c),d=evaluate(f.c);expect(d.sourceMovement,held.id).toBeUndefined();const spec=qualified.get(held.id);
  if(spec){seen.add(held.id);expect(relativeRacialMovementRule(f.owner.entry)?.id).toBe(spec.id);expect(d.relativeMovement?.[spec.mode]).toBe(d.speed);expect(d.issues.some(issue=>issue.id.startsWith('racial-movement:held:')),held.id).toBe(false);}
  else{unresolved++;expect(relativeRacialMovementRule(f.owner.entry)).toBeUndefined();expect(d.relativeMovement).toBeUndefined();expect(d.issues.some(issue=>issue.id.startsWith('racial-movement:held:')),held.id).toBe(true);}
  expect(racialMovementDigest(f.c)).toBe(saved);
 }
 expect(seen.size).toBe(6);expect(unresolved).toBe(26);
});
it('selected-race removal/replacement and native/linked reopen preserve spent resources and do not save derived movement',()=>{
 const f=racialMovementFixture(),saved=racialMovementDigest(f.c),derived=evaluate(f.c);for(const file of [exportCharacter(f.c),exportLinkedOwlbear(f.c,derived).dnd_card_web]){const reopened=readCharacter(JSON.parse(JSON.stringify(file))).character;expect(racialMovementDigest(reopened)).toBe(saved);expect(evaluate(reopened).sourceMovement).toEqual({swim:30});expect(Object.hasOwn(reopened,'sourceMovement')).toBe(false);}
 const without=structuredClone(derived);delete without.sourceMovement;delete without.trace.sourceMovement;expect(racialMovementDigest(exportOwlbear(f.c,derived))).toBe(racialMovementDigest(exportOwlbear(f.c,without)));expect(racialMovementDigest(exportLinkedOwlbear(f.c,derived))).toBe(racialMovementDigest(exportLinkedOwlbear(f.c,without)));
 const manual=racialMovementDigest({notes:f.c.notes,runtime:f.c.runtime,adjustments:f.c.adjustments,sheetBonuses:f.c.sheetBonuses,externalSnapshot:f.c.externalSnapshot});removeSelection(f.c,f.owner.id);expect(evaluate(f.c).sourceMovement).toBeUndefined();const human=f.entries.find(entry=>entry.kind==='race'&&entry.english==='Human'&&entry.source==='PHB')!;f.c.selections.push({id:'replacement-owner',entry:structuredClone(human),quantity:1,level:1,equipped:false});expect(evaluate(f.c).sourceMovement).toBeUndefined();expect(racialMovementDigest({notes:f.c.notes,runtime:f.c.runtime,adjustments:f.c.adjustments,sheetBonuses:f.c.sheetBonuses,externalSnapshot:f.c.externalSnapshot})).toBe(manual);
});
