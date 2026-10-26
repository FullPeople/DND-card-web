import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
import {reviewedAlertRule,reviewedAlertStatus,setReviewedAlertIntent} from '../src/core/automation/reviewedAlert';
import {reviewedAlertIdentity,reviewedModernAlertRule} from '../src/core/automation/reviewedAlertSource';
import evidence from '../src/core/automation/reviewedAlertEvidence.json';
import {alertDirectory,alertFrozenInput,alertIntent,alertManualSnapshot,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';

if(process.env.REVIEWED_ALERT_FROZEN_REQUIRED==='1'&&!alertDirectory)throw Error('REVIEWED_ALERT_FROZEN_REQUIRED requires REVIEWED_FEATS_FROZEN_DIR with the exact private frozen corpus.');
const textHash=(value:string)=>createHash('sha256').update(value).digest('hex');
const normalized=new Map<string,Entry[]>();
function records(path:string,sha:string){if(!normalized.has(path))normalized.set(path,normalizeData(structuredClone(alertFrozenInput(path,sha)),'alert-frozen-source'));return structuredClone(normalized.get(path)!);}
function feats(){return records('feats.json',evidence.inputs['feats.json']);}

describe.skipIf(!alertDirectory)('exact private frozen Alert source authentication',()=>{
 it('authenticates both complete source records and all three PHB clause hashes without publishing their prose',()=>{
  const body=alertFrozenInput('feats.json',evidence.inputs['feats.json']),entries=feats();
  for(const proof of [evidence.feat,evidence.modern]){
   const raw=body.feat.filter((row:any)=>row.ENG_name==='Alert'&&row.source===proof.reference.split('|')[1]);expect(raw).toHaveLength(1);expect(alertSnapshot(raw[0])).toBe(proof.entryHash);expect(Object.keys(raw[0])).toEqual(proof.rawKeys);
   const entry=entries.find(row=>row.id===proof.entryId)!;expect(entry).toBeDefined();expect(entry.packId).toBe('kiwee');expect(entry.kind).toBe('feat');expect(entry.raw._category).toBe('feat');
  }
  const phb=entries.find(row=>row.id===evidence.feat.entryId)!,modern=entries.find(row=>row.id===evidence.modern.entryId)!;
  expect(reviewedAlertRule(phb)).toEqual({kind:'alert',reference:'Alert|PHB',page:165,initiativeBonus:5});expect(reviewedModernAlertRule(phb)).toBe(false);expect(reviewedAlertIdentity(phb)).toBe(true);
  expect(reviewedModernAlertRule(modern)).toBe(true);expect(reviewedAlertRule(modern)).toBeUndefined();expect(reviewedAlertIdentity(modern)).toBe(false);
  for(const clause of Object.values(evidence.feat.clauses))expect(textHash(phb.raw.entries[1].items[clause.index])).toBe(clause.sha256);
  expect(evidence.feat.clauses.surprise.automated).toBe(false);expect(evidence.feat.clauses.unseenAttackers.automated).toBe(false);expect(textHash(JSON.stringify(modern.raw.entries))).toBe(evidence.modern.entriesSha256);
 });
 it('pins the 13 real class inputs and all 68 unique canonical legacy ASI source slots',()=>{
  expect(Object.keys(evidence.legacyClassInputs)).toHaveLength(13);expect(evidence.legacyClassSlots).toHaveLength(68);expect(new Set(evidence.legacyClassSlots.map(slot=>`${slot.ownerEntryId}|${slot.featureEntryId}`)).size).toBe(68);
  for(const [path,sha] of Object.entries(evidence.legacyClassInputs))expect(records(path,sha).length).toBeGreaterThan(0);
 });
 it.each(evidence.legacyClassSlots)('actual $owner ASI$level canonical source confirms initiative 7 and reopens offline without manual/resource writes',slot=>{
  const path=`class/class-${slot.owner.split('|')[0].toLowerCase()}.json` as keyof typeof evidence.legacyClassInputs,entries=[...records(path,evidence.legacyClassInputs[path]),...feats()],owner=entries.find(row=>row.id===slot.ownerEntryId)!,source=entries.find(row=>row.id===slot.featureEntryId)!,feat=entries.find(row=>row.id===evidence.feat.entryId)!;
  expect(owner).toBeDefined();expect(source).toBeDefined();expect(owner.packId).toBe('kiwee');expect(source.packId).toBe('kiwee');expect(source.raw.className).toBe(owner.raw.name);expect(source.raw.classSource).toBe(owner.source);expect(source.raw.level).toBe(slot.level);
  const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','TCE'];c.abilities.dex=14;c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:2};c.training={tools:'Authored tools',languages:'Authored languages'};c.quickbarActions=[{id:'authored',name:'Authored action',attack:'+12',damage:'3d6'}];c.selections=[{id:'owner',entry:owner,level:slot.level,quantity:1,equipped:false}];syncFeatures(c,entries);
  const choice=sheetChoices(c,entries).find(row=>row.id===`owner:class-legacy-feat:${slot.featureEntryId}`)!;expect(choice).toBeDefined();expect(choice.grantLevel).toBe(slot.level);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
  const before=alertManualSnapshot(c);expect(evaluate(c).initiative).toBe(2);setReviewedAlertIntent(c,choice.id,feat.id,alertIntent(),entries);expect(alertManualSnapshot(c)).toBe(before);expect(reviewedAlertStatus(c,choice.id,feat.id)).toMatchObject({eligible:true,active:true,initiativeBonus:5});
  const saved=alertSnapshot(c);expect(evaluate(c).initiative).toBe(7);expect(alertSnapshot(c)).toBe(saved);const reopened=validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));syncFeatures(reopened,[]);expect(evaluate(reopened).initiative).toBe(7);expect(reopened.reviewedAlert).toEqual(c.reviewedAlert);expect(reopened.runtime).toEqual(c.runtime);expect(reopened.training).toEqual(c.training);expect(reopened.quickbarActions).toEqual(c.quickbarActions);
 });
 it.each(['pack','source','kind','clause','mechanics','nonarray'] as const)('genuine PHB/XPHB records with forged %s cannot authorize the reviewed rule',mode=>{
  for(const source of [evidence.feat.entryId,evidence.modern.entryId]){
   const entry=feats().find(row=>row.id===source)!;
   if(mode==='pack')entry.packId='kiwee-homebrew';if(mode==='source')entry.raw.source='OTHER';if(mode==='kind')entry.kind='feature';if(mode==='clause'){if(source===evidence.feat.entryId)entry.raw.entries[1].items[0]+=' authored mismatch';else entry.raw.entries[0]='Authored mismatch';entry.entries=structuredClone(entry.raw.entries);}if(mode==='mechanics')entry.raw.ability=[{dex:1}];if(mode==='nonarray')(entry as any).effects={};
   expect(reviewedAlertRule(entry)).toBeUndefined();expect(reviewedModernAlertRule(entry)).toBe(false);expect(reviewedAlertIdentity(entry)).toBe(true);
  }
 });
 it('rejects cross-edition canonical ID forgery even when the other edition source bytes are genuine',()=>{
  const entries=feats(),phb=entries.find(row=>row.id===evidence.feat.entryId)!,modern=entries.find(row=>row.id===evidence.modern.entryId)!;phb.id=evidence.modern.entryId;modern.id=evidence.feat.entryId;
  expect(reviewedAlertRule(phb)).toBeUndefined();expect(reviewedModernAlertRule(modern)).toBe(false);expect(reviewedAlertIdentity(phb)).toBe(true);expect(reviewedAlertIdentity(modern)).toBe(true);
 });
 it('a genuine imported feat alias honors both its own and canonical PHB source-disable identities',()=>{
  const s=setupAlert(),alias=structuredClone(s.feat);alias.id='authored-imported-alert-alias';const entries=[...s.entries,alias];expect(reviewedAlertRule(alias)?.initiativeBonus).toBe(5);setSheetChoiceSlot(s.c,s.choice.id,0,alias.id,entries);setReviewedAlertIntent(s.c,s.choice.id,alias.id,alertIntent(),entries);expect(evaluate(s.c).initiative).toBe(7);
  for(const id of [alias.id,evidence.feat.entryId]){s.c.profile.disabledEntries=[id];const saved=alertSnapshot(s.c);expect(reviewedAlertStatus(s.c,s.choice.id,alias.id).active).toBe(false);expect(evaluate(s.c).initiative).toBe(2);expect(()=>setReviewedAlertIntent(s.c,s.choice.id,alias.id,alertIntent(),entries)).toThrow();expect(alertSnapshot(s.c)).toBe(saved);s.c.profile.disabledEntries=[];expect(evaluate(s.c).initiative).toBe(7);}
 });
});
