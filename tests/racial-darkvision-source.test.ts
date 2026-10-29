import {beforeAll,describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {validateCharacter,readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import {projectRacialDarkvision,racialDarkvisionRule,racialDarkvisionSnapshot} from '../src/core/automation/racialDarkvision';
import {newCharacter,type Entry} from '../src/core/model';
import evidence from '../src/core/automation/racialDarkvisionEvidence.json';
import {racialDarkvisionDirectory,racialDarkvisionEntries,racialDarkvisionFixture,racialDarkvisionDigest} from './helpers/racialDarkvisionFixture';

describe('actual pinned racial darkvision source and ownership',()=>{
 beforeAll(()=>{if(!racialDarkvisionDirectory)throw Error('Mandatory RACIAL_DARKVISION_FROZEN_DIR required');racialDarkvisionEntries();},30000);
 const approved=evidence.rules.filter(r=>r.supported),held=evidence.rules.filter(r=>!r.supported);
 it('has exact239 admitted /16 held IDs, six original pins and no body-bearing evidence',()=>{
  expect(approved.length).toBe(239);expect(held.length).toBe(16);expect(evidence.inputs.length).toBe(6);
  expect(new Set(evidence.rules.map(r=>r.id)).size).toBe(255);
  const prohibited=(v:unknown):boolean=>!!v&&typeof v==='object'&&(Array.isArray(v)?v.some(prohibited):Object.entries(v).some(([k,x])=>['raw','entries','body','text','character','card'].includes(k)||prohibited(x)));
  expect(prohibited(evidence)).toBe(false);
 });
 for(const rule of approved)it(`actual root-race projection ${rule.id}`,()=>{
  const {c,owner}=racialDarkvisionFixture(rule.id),before=racialDarkvisionDigest(c);
  expect(owner.entry.kind==='race'&&!owner.parentId).toBe(true);
  expect(racialDarkvisionSnapshot(owner.entry)===rule.fullNormalizedSnapshotSha256).toBe(true);
  const projection=projectRacialDarkvision(c),derived=evaluate(c);
  expect(projection.darkvision).toBe(rule.rangeFeet);
  expect(projection.grants.map(g=>g.entryId)).toEqual([rule.id]);
  expect(derived.senses?.darkvision).toBe(rule.rangeFeet);
  expect(derived.trace.darkvision.length>0).toBe(true);
  expect(racialDarkvisionDigest(c)).toBe(before);
 });
 for(const rule of held)it(`holds exact conditional/conflicting source ${rule.id}`,()=>{
  const {c}=racialDarkvisionFixture(rule.id),before=racialDarkvisionDigest(c);
  expect(racialDarkvisionRule(c.selections[0].entry)?.supported).toBe(false);
  expect(evaluate(c).senses?.darkvision).toBeUndefined();
  expect(projectRacialDarkvision(c).issues.some(i=>i.id.startsWith('racial-darkvision:held:'))).toBe(true);
  expect(racialDarkvisionDigest(c)).toBe(before);
 });
 it('pauses and resumes on current source availability without losing snapshots/manual data',()=>{
  const {c}=racialDarkvisionFixture(),entryBefore=racialDarkvisionDigest(c.selections[0].entry);
  c.profile.enabledSources=[];const disabled=racialDarkvisionDigest(c);
  expect(evaluate(c).senses).toBeUndefined();expect(racialDarkvisionDigest(c)).toBe(disabled);
  c.profile.enabledSources=['PHB'];expect(evaluate(c).senses?.darkvision).toBe(60);
  expect(racialDarkvisionDigest(c.selections[0].entry)).toBe(entryBefore);
 });
 it('does not let a generic exception bypass explicit source or canonical disables',()=>{
  const {c,entry}=racialDarkvisionFixture();c.profile.exceptions[entry.id]='Authored retained generic exception';c.profile.enabledSources=[];
  expect(evaluate(c).senses).toBeUndefined();c.profile.enabledSources=['PHB'];c.profile.disabledEntries=[entry.id];expect(evaluate(c).senses).toBeUndefined();
 });
 it('checks inherited parent source availability even though the complete child is its own root',()=>{
  const rule=approved.find(r=>r.category==='subrace'&&r.source!=='PHB'&&r.requiredSources.includes('PHB'))!;
  expect(!!rule).toBe(true);const {c}=racialDarkvisionFixture(rule.id);
  expect(evaluate(c).senses?.darkvision).toBe(rule.rangeFeet);
  c.profile.enabledSources=c.profile.enabledSources.filter(s=>s!=='PHB');
  expect(evaluate(c).senses).toBeUndefined();
 });
 it('checks declared entry dependencies in the live source chain',()=>{
  const {c,entry}=racialDarkvisionFixture();entry.dependencies=['AUTHORED'];
  // An injected dependency changes the complete source proof, so cannot grant.
  c.profile.enabledSources.push('AUTHORED');expect(evaluate(c).senses).toBeUndefined();
 });
 it('accepts only a coherent unreserved alias and transport revision',()=>{
  const {c,entry}=racialDarkvisionFixture();entry.id='authored-coherent-racial-alias';entry.revision='transport-etag';
  expect(racialDarkvisionRule(entry)?.id).toBe(evidence.rules.find(r=>r.english==='Dwarf'&&r.source==='PHB')!.id);
  expect(evaluate(c).senses?.darkvision).toBe(60);
  c.profile.disabledEntries=[entry.id];expect(evaluate(c).senses).toBeUndefined();
 });
 it('disabling canonical source also pauses a coherent alias',()=>{
  const {c,entry}=racialDarkvisionFixture(),canonical=entry.id;entry.id='authored-disabled-canonical-alias';
  c.profile.disabledEntries=[canonical];expect(evaluate(c).senses).toBeUndefined();
 });
 it('a canonical ID from another real entry cannot be used as an alias',()=>{
  const {c,entry,entries}=racialDarkvisionFixture();entry.id=entries.find(e=>e.kind==='race'&&e.english==='Human'&&e.source==='PHB')!.id;
  expect(racialDarkvisionRule(entry)).toBeUndefined();expect(evaluate(c).senses).toBeUndefined();
 });
 const mutations:{name:string;change:(e:Entry)=>void}[]=[
  {name:'source',change:e=>{e.source='XPHB';}},
  {name:'pack',change:e=>{e.packId='authored-foreign';}},
  {name:'edition',change:e=>{e.edition='2024';}},
  {name:'kind',change:e=>{e.kind='feature';}},
  {name:'name',change:e=>{e.name+=' authored';}},
  {name:'English header',change:e=>{e.english+=' authored';}},
  {name:'page',change:e=>{e.page=(e.page||0)+1;}},
  {name:'category',change:e=>{e.raw._category='monster';}},
  {name:'raw numeric field',change:e=>{e.raw.darkvision=600;}},
  {name:'source clause',change:e=>{e.entries=[...e.entries,'Authored extra clause'];}},
  {name:'raw extra field',change:e=>{e.raw.authoredExtra=true;}},
  {name:'copy',change:e=>{e.raw._copy={name:'Authored parent',source:'PHB'};}},
  {name:'unresolved ancestor',change:e=>{e.raw._unresolvedParent=true;}},
  {name:'effects payload',change:e=>{e.effects=[{op:'add',target:'ac',value:1}];}},
  {name:'nonarray entries',change:e=>{(e as any).entries={authored:true};}},
  {name:'nonobject raw',change:e=>{(e as any).raw=[];}},
 ];
 for(const mutation of mutations)it(`denies forged ${mutation.name} without source repair`,()=>{
  const {c,entry}=racialDarkvisionFixture();mutation.change(entry);const before=racialDarkvisionDigest(c);
  expect(racialDarkvisionRule(entry)).toBeUndefined();
  expect(projectRacialDarkvision(c).darkvision).toBeUndefined();
  expect(racialDarkvisionDigest(c)).toBe(before);
 });
 it('does not quarantine unrelated generic manual racial mechanics when sense proof fails',()=>{
  const {c,entry}=racialDarkvisionFixture();c.adjustments=[];c.sheetBonuses={};entry.raw.darkvision=600;entry.effects=[{op:'add',target:'ac',value:3}];
  expect(evaluate(c).senses).toBeUndefined();expect(evaluate(c).ac).toBe(13);
 });
 it('does not poison a foreign custom same-name source or infer its numeric sense',()=>{
  const {c,entry}=racialDarkvisionFixture();c.adjustments=[];c.sheetBonuses={};entry.id='authored-custom-race';entry.packId='custom';entry.source='CUSTOM';entry.raw._custom=true;entry.effects=[{op:'add',target:'ac',value:2}];
  expect(evaluate(c).senses).toBeUndefined();expect(evaluate(c).ac).toBe(12);
 });
 it('does not stack duplicate or unrelated racial owners',()=>{
  const {c,owner}=racialDarkvisionFixture();c.selections.push(structuredClone(owner));
  expect(projectRacialDarkvision(c).darkvision).toBeUndefined();
  c.selections[1].id='other-owner';expect(projectRacialDarkvision(c).darkvision).toBeUndefined();
 });
 it('rejects a race child/cyclic owner and a supplied active list cannot authorize it',()=>{
  const {c,owner}=racialDarkvisionFixture();owner.parentId=owner.id;
  expect(projectRacialDarkvision(c,[owner]).darkvision).toBeUndefined();
 });
 it('caller active subset can exclude but never substitute ownership',()=>{
  const {c,owner}=racialDarkvisionFixture();expect(projectRacialDarkvision(c,[]).darkvision).toBeUndefined();
  expect(projectRacialDarkvision(c,[structuredClone(owner)]).darkvision).toBeUndefined();
  expect(evaluate(c,new Set([owner.id])).senses).toBeUndefined();
 });
 it('withdraws range on actual remove and replacement while keeping manual data/resources',()=>{
  const {c,owner,entries}=racialDarkvisionFixture(),manual=racialDarkvisionDigest({notes:c.notes,resources:c.runtime.resources,adjustments:c.adjustments,bonuses:c.sheetBonuses});
  removeSelection(c,owner.id);expect(evaluate(c).senses).toBeUndefined();
  const human=entries.find(e=>e.kind==='race'&&e.english==='Human'&&e.source==='PHB')!;
  c.selections.push({id:'replacement-race',entry:structuredClone(human),quantity:1,level:1,equipped:false});
  expect(evaluate(c).senses).toBeUndefined();
  expect(racialDarkvisionDigest({notes:c.notes,resources:c.runtime.resources,adjustments:c.adjustments,bonuses:c.sheetBonuses})).toBe(manual);
 });
 it('native and linked envelopes preserve complete sources without a saved derived field',()=>{
  const {c}=racialDarkvisionFixture(),before=racialDarkvisionDigest(c);
  const reopened=validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));
  expect(racialDarkvisionDigest(reopened)).toBe(before);expect(evaluate(reopened).senses?.darkvision).toBe(60);
  const linked=readCharacter(JSON.parse(JSON.stringify({character:exportLinkedOwlbear(c,evaluate(c)).dnd_card_web}))).character;
  expect(racialDarkvisionDigest(linked)).toBe(before);expect(evaluate(linked).senses?.darkvision).toBe(60);
  expect(Object.hasOwn(c,'senses')).toBe(false);
  const withRange=evaluate(c),withoutRange=structuredClone(withRange);delete withoutRange.senses;delete withoutRange.trace.darkvision;
  expect(racialDarkvisionDigest(exportOwlbear(c,withRange))).toBe(racialDarkvisionDigest(exportOwlbear(c,withoutRange)));
  expect(racialDarkvisionDigest(exportLinkedOwlbear(c,withRange))).toBe(racialDarkvisionDigest(exportLinkedOwlbear(c,withoutRange)));
 });
 it('preserves saved source mechanics on card edition change without changing source identity',()=>{
  const {c,entry}=racialDarkvisionFixture(),source=racialDarkvisionDigest(entry);c.edition='2024';
  expect(evaluate(c).senses?.darkvision).toBe(60);expect(racialDarkvisionDigest(entry)).toBe(source);
 });
 it('automation off and future protocol stay inactive with native bytes preserved',()=>{
  const {c}=racialDarkvisionFixture();c.automation!.enabled=false;let before=racialDarkvisionDigest(c);
  expect(evaluate(c).senses).toBeUndefined();expect(racialDarkvisionDigest(c)).toBe(before);
  c.automation!.protocol=999;before=racialDarkvisionDigest(c);expect(evaluate(c).senses).toBeUndefined();expect(racialDarkvisionDigest(c)).toBe(before);
 });
 it('thin imported race/manual totals do not mint source ownership',()=>{
  const c=newCharacter('2014');c.notes='Authored manual darkvision 777 feet';c.externalSnapshot={authoredManualVision:777};
  c.selections.push({id:'imported-racial-owner',entry:{id:'imported:race:Dwarf',kind:'race',name:'矮人',english:'Dwarf',source:'IMPORTED',edition:'both',packId:'imported',revision:'manual',entries:[],raw:{darkvision:777}},quantity:1,level:1,equipped:false});
  c.profile.enabledSources.push('IMPORTED');const before=racialDarkvisionDigest(c);
  expect(evaluate(c).senses).toBeUndefined();expect(racialDarkvisionDigest(c)).toBe(before);
 });
});
