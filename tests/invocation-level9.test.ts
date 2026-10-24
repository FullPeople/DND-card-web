import {describe,expect,it} from 'vitest';
import {invocationLevel9Fixture,level9Invocations} from './fixtures/invocationLevel9Fixture';
import {learn,sync} from './fixtures/invocationFixture';
import {invocationRule} from '../src/core/automation/invocations';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {planSourceSpells} from '../src/core/automation/sourceSpells';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {exportCharacter} from '../src/core/export';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {evaluate} from '../src/core/engine';
import type {Character} from '../src/core/model';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';

const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
const root=(c:Character,name:string)=>c.selections.find(row=>row.entry.english===name&&row.grantKey?.startsWith('choice:'))!;
const child=(c:Character,name:string)=>c.selections.find(row=>row.parentId===root(c,name)?.id&&row.grantKey?.startsWith('source-spell:'))!;

describe.each(level9Invocations)('$english PHB level-nine invocation',({english,spell,level,self})=>{
 it('recognizes the exact reviewed prerequisite and offers the correct spell level at Warlock nine',()=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture();
  expect(invocationRule(find(english))).toMatchObject({reference:`${english}|PHB`,spellReference:`${spell}|PHB`,spellLevel:level,requiredClassLevel:9});
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(option=>option.value===find(english).id)?.grant).toBeDefined();
  learn(c,entries,find(english));expect(child(c,english).entry.english).toBe(spell);
  const payment=spellPayments(c,child(c,english).id).options;
  expect(payment).toMatchObject([{id:'free',level,cost:0,available:true}]);
  expect(payment[0].label.includes('仅自身')).toBe(self);
 });
});

describe.each(level9Invocations)('$english prerequisite and identity boundaries',({english,spell,level})=>{
 it.each([1,2,8])('does not learn from Warlock %i even when total character level is nine or greater',at=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture(at);
  const other=structuredClone(c.selections[0]);other.id='fighter';other.entry.id='fighter-entry';other.entry.english='Fighter';other.entry.name='Warlock';other.entry.raw.ENG_name='Fighter';other.level=9;other.entry.raw.optionalfeatureProgression=[];c.selections.push(other);
  const before=JSON.stringify(c),option=sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===find(english).id);
  if(option){expect(option.unavailable).toContain('职业等级 9');expect(option.grant).toBeUndefined();}
  expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
 });
 it('uses its own PHB Warlock parent, not another Warlock-nine row',()=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture(8),other=structuredClone(c.selections[0]);other.id='another-warlock';other.level=9;c.selections.push(other);
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===find(english).id)?.unavailable).toContain('职业等级 9');
 });
 it.each(['missing','numeric','lower-level','higher-level','extra-level-key','missing-class','other-class','explicit-source','unknown-condition','or-alternative','empty','null'] as const)('does not grant when the exact prerequisite is changed to %s',mode=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture(),entry=find(english);
  if(mode==='missing')delete entry.raw.prerequisite;
  if(mode==='numeric')entry.raw.prerequisite=[{level:9}];
  if(mode==='lower-level')entry.raw.prerequisite[0].level.level=2;
  if(mode==='higher-level')entry.raw.prerequisite[0].level.level=12;
  if(mode==='extra-level-key')entry.raw.prerequisite[0].level.extra=true;
  if(mode==='missing-class')delete entry.raw.prerequisite[0].level.class;
  if(mode==='other-class')entry.raw.prerequisite[0].level.class={ENG_name:'Fighter',name:'战士'};
  if(mode==='explicit-source')entry.raw.prerequisite[0].level.class.source='PHB';
  if(mode==='unknown-condition')entry.raw.prerequisite[0].unknownCondition=true;
  if(mode==='or-alternative')entry.raw.prerequisite.push({});
  if(mode==='empty')entry.raw.prerequisite=[];
  if(mode==='null')entry.raw.prerequisite=null;
  expect(invocationRule(entry)).toBeUndefined();expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===entry.id)?.grant).toBeUndefined();
  c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:structuredClone(entry)};sync(c,entries);expect(root(c,english)).toBeUndefined();
 });
 it.each(['english','raw-english','source','raw-source','edition','copy','unknown-mechanics'] as const)('does not grant an invocation with altered %s',mode=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture(),entry=find(english);
  if(mode==='english')entry.english='Unreviewed Invocation';if(mode==='raw-english')entry.raw.ENG_name='Unreviewed Invocation';if(mode==='source')entry.source='TCE';if(mode==='raw-source')entry.raw.source='TCE';if(mode==='edition')entry.edition='2024';if(mode==='copy')entry.raw._copy={};if(mode==='unknown-mechanics')entry.raw.unreviewedMechanism=true;
  expect(invocationRule(entry)).toBeUndefined();expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===entry.id)?.grant).toBeUndefined();
 });
 it.each(['english','raw-english','source','raw-source','edition','raw-edition','copy','level','parent','grant-key'] as const)('rejects saved child %s changes at payment time without mutation',mode=>{
  const {c,entries,find}=invocationLevel9Fixture();learn(c,entries,find(english));const row=child(c,english),request=spellActionRequest(c,row.id,'free','forged-child');
  if(mode==='english')row.entry.english='Unreviewed Spell';if(mode==='raw-english')row.entry.raw.ENG_name='Unreviewed Spell';if(mode==='source')row.entry.source='TCE';if(mode==='raw-source')row.entry.raw.source='TCE';if(mode==='edition')row.entry.edition='2024';if(mode==='raw-edition')row.entry.raw.edition='one';if(mode==='copy')row.entry.raw._copy={};if(mode==='level')row.entry.raw.level=level===1?2:1;if(mode==='parent')row.parentId='warlock';if(mode==='grant-key')row.grantKey='source-spell:forged';
  const before=JSON.stringify(c);expect(spellPayments(c,row.id).options).toEqual([]);expect(performSpellAction(c,request).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['raw-english','raw-source','source','edition','copy','raw-edition','grant-key','answer','prerequisite','forged-payment-level'] as const)('rejects changed owner or qualification %s even with a previously offered free payment',mode=>{
  const {c,entries,find}=invocationLevel9Fixture();learn(c,entries,find(english));const row=child(c,english),invocation=root(c,english),owner=c.selections[0],request=spellActionRequest(c,row.id,'free','stale-free');
  if(mode==='raw-english')owner.entry.raw.ENG_name='Fighter';if(mode==='raw-source')owner.entry.raw.source='TCE';if(mode==='source')owner.entry.source='TCE';if(mode==='edition')owner.entry.edition='2024';if(mode==='copy')owner.entry.raw._copy={};if(mode==='raw-edition')owner.entry.raw.edition='one';if(mode==='grant-key')invocation.grantKey='choice:forged';if(mode==='answer')c.answers[invocation.requirementId!]=[];if(mode==='prerequisite')invocation.entry.raw.prerequisite[0].level.level=1;if(mode==='forged-payment-level')c.spellSettings!.special![row.id].sourceGrant!.castLevel=9;
  const before=JSON.stringify(c);
  if(mode==='forged-payment-level'){
   // Persisted payment metadata cannot upcast a reviewed invocation. Planning
   // recomputes the canonical spell level rather than trusting this old cache.
   expect(spellPayments(c,row.id).options).toMatchObject([{id:'free',level}]);expect(JSON.stringify(c)).toBe(before);
   const result=performSpellAction(c,request);expect(result).toMatchObject({status:'applied',receipt:{level}});
  }else{expect(spellPayments(c,row.id).options).toEqual([]);expect(performSpellAction(c,request).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);}
 });
 it.each(['source','owner','feature','invocation'] as const)('immediately rejects %s disablement before synchronization',mode=>{
  const {c,entries,find}=invocationLevel9Fixture();learn(c,entries,find(english));const row=child(c,english),request=spellActionRequest(c,row.id,'free','before-source-disabled');
  if(mode==='source')c.profile.enabledSources=[];
  else c.profile.disabledEntries=[mode==='owner'?c.selections[0].entry.id:mode==='feature'?c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.id:root(c,english).entry.id];
  const before=JSON.stringify(c);expect(spellPayments(c,row.id).options).toEqual([]);expect(performSpellAction(c,request).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 });
 it('preserves manual same-name invocations and does not adopt their grants',()=>{
  const {c,entries,find,choiceId}=invocationLevel9Fixture(),entry={...structuredClone(find(english)),id:'manual-entry'};c.selections.push({id:'manual-invocation',entry,level:1,quantity:1,equipped:false});const manual=structuredClone(c.selections.at(-1));
  expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow('手工');sync(c,entries);expect(c.selections.find(row=>row.id==='manual-invocation')).toEqual(manual);expect(root(c,english)).toBeUndefined();
  for(const row of c.selections.filter(row=>row.parentId==='manual-invocation'))expect(spellPayments(c,row.id).options).toEqual([]);
 });
 it('accepts display label edits without accepting canonical lookalike spells',()=>{
  const {c,entries,find}=invocationLevel9Fixture();find(english).name='My invocation';find(spell).name='My spell';const lookalike={...structuredClone(find(spell)),id:'lookalike',english:'Unreviewed Spell'};lookalike.raw.ENG_name='Unreviewed Spell';entries.push(lookalike);learn(c,entries,find(english));expect(child(c,english).entry.id).toBe(find(spell).id);expect(spellPayments(c,child(c,english).id).options).toMatchObject([{id:'free',level}]);
 });
});

function learnedThree(){const setup=invocationLevel9Fixture();for(const [slot,row] of level9Invocations.entries())learn(setup.c,setup.entries,setup.find(row.english),slot);return setup;}
const mechanics=(c:Character)=>{const result=evaluate(c);return {ac:result.ac,speed:result.speed,maxHp:result.maxHp,abilities:result.abilities,skills:result.skills,saves:result.saves};};

describe('level-nine invocation preserved learning lifecycle',()=>{
 it('repeats 1/2/3-level free casts through reopen with manual state, resources and all actual spell effects unchanged',()=>{
  const {c,entries,find}=invocationLevel9Fixture();c.notes='Manual adjudication';c.identity.description='Manual appearance';c.runtime.hp=2;c.sheetBonuses={ac:3};c.runtime.resources.manual={current:1,max:7};c.runtime.resources['pact-slot:5']={current:0,max:2};c.runtime.resources['spell-slot:3']={current:1,max:3};
  for(const row of level9Invocations){const id=`manual-${row.level}`;c.selections.push({id,entry:structuredClone(find(row.spell)),level:1,quantity:1,equipped:false});setSpecialSpell(c,id,{mode:'uses',max:3});changeSpecialSpellUses(c,id,1);}
  const manual=structuredClone(c.selections.filter(row=>row.id.startsWith('manual-'))),settings=structuredClone(c.spellSettings!.special),resources=structuredClone(c.runtime.resources),baseline=mechanics(c);
  for(const [slot,row] of level9Invocations.entries())learn(c,entries,find(row.english),slot);
  const ids=level9Invocations.map(row=>[root(c,row.english).id,child(c,row.english).id]);let saved=roundtrip(c);
  for(let attempt=0;attempt<3;attempt++){
   sync(saved,[]);expect(level9Invocations.map(row=>[root(saved,row.english).id,child(saved,row.english).id])).toEqual(ids);
   for(const row of level9Invocations){const granted=child(saved,row.english),before=JSON.stringify(saved),request=spellActionRequest(saved,granted.id,'free',`repeat-${attempt}-${row.level}`);expect(spellPayments(saved,granted.id).options).toMatchObject([{id:'free',level:row.level,cost:0}]);expect(JSON.stringify(saved)).toBe(before);expect(performSpellAction(saved,request)).toMatchObject({status:'applied',receipt:{level:row.level}});const after=JSON.stringify(saved);expect(performSpellAction(saved,request).status).toBe('duplicate');expect(JSON.stringify(saved)).toBe(after);expect(spellPayments(saved,`manual-${row.level}`).options).toEqual([]);}
   saved=roundtrip(saved);
  }
  expect(saved.runtime.resources).toEqual(resources);expect(saved.selections.filter(row=>row.id.startsWith('manual-'))).toEqual(manual);for(const row of manual)expect(saved.spellSettings!.special![row.id]).toEqual(settings![row.id]);expect(mechanics(saved)).toEqual(baseline);expect(saved.notes).toBe('Manual adjudication');expect(saved.identity.description).toBe('Manual appearance');expect(saved.runtime.hp).toBe(2);expect(saved.runtime.automationActions?.sequence).toBe(9);validateCharacter(saved);
 });
 it('immediately rejects all first-three-slot payments at Warlock eight, retains answers, archives trees and restores identical IDs at nine without catalog',()=>{
  const {c,entries,find,choiceId}=learnedThree(),roots=level9Invocations.map(row=>root(c,row.english)),spells=level9Invocations.map(row=>child(c,row.english));
  c.selections.push({id:'manual-child',entry:structuredClone(find('Mage Armor')),parentId:roots[0].id,quantity:1,level:1,equipped:false});setSpecialSpell(c,'manual-child',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-child',1);
  const trees=roots.map(root=>structuredClone(c.selections.filter(row=>row.id===root.id||row.parentId===root.id))),answers=structuredClone(c.answers[choiceId]),resource=specialSpellResource('manual-child',c),requests=spells.map(row=>spellActionRequest(c,row.id,'free',`before-down-${row.id}`));
  c.selections[0].level=8;
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.count).toBe(4); // All three answers remain within capacity.
  for(const [index,row] of spells.entries()){const before=JSON.stringify(c);expect(spellPayments(c,row.id).options).toEqual([]);expect(performSpellAction(c,requests[index]).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);}
  sync(c,entries);expect(c.answers[choiceId]).toEqual(answers);for(const [index,root] of roots.entries()){expect(c.classChoiceArchive?.[root.id].selections).toEqual(trees[index]);expect(c.selections.some(row=>row.id===root.id||row.parentId===root.id)).toBe(false);}
  const saved=roundtrip(c);saved.selections[0].level=9;sync(saved,[]);
  for(const [index,root] of roots.entries())expect(JSON.parse(JSON.stringify(saved.selections.filter(row=>row.id===root.id||row.parentId===root.id)))).toEqual(JSON.parse(JSON.stringify(trees[index])));
  for(const row of spells)expect(spellPayments(saved,row.id).options.map(option=>option.id)).toEqual(['free']);expect(saved.runtime.resources[resource].current).toBe(1);expect(saved.answers[choiceId]).toEqual(answers);validateCharacter(saved);
 });
 it.each(['source','owner-disabled','feature-disabled','invocation-disabled','replace','forget','automation'] as const)('revokes %s without consuming manual resources and restores original records after reopening',mode=>{
  const {c,entries,find,choiceId}=learnedThree(),oldRoot=root(c,'Otherworldly Leap'),oldSpell=child(c,'Otherworldly Leap');c.selections.push({id:'manual-spell',entry:structuredClone(find('Jump')),quantity:1,level:1,equipped:false});setSpecialSpell(c,'manual-spell',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-spell',1);const manual=structuredClone(c.selections.at(-1)),resources=structuredClone(c.runtime.resources),tree=structuredClone(c.selections.filter(row=>row.id===oldRoot.id||row.parentId===oldRoot.id));
  if(mode==='source')c.profile.enabledSources=[];if(mode==='owner-disabled')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='feature-disabled')c.profile.disabledEntries=[c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.id];if(mode==='invocation-disabled')c.profile.disabledEntries=[oldRoot.entry.id];if(mode==='replace')setSheetChoiceSlot(c,choiceId,0,find('Eldritch Sight').id,entries);if(mode==='forget')setSheetChoiceSlot(c,choiceId,0,undefined,entries);if(mode==='automation')c.automation!.enabled=false;
  sync(c,entries);const before=JSON.stringify(c);expect(spellPayments(c,oldSpell.id).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,oldSpell.id,'free','disabled')).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
  if(mode!=='automation'){expect(c.classChoiceArchive?.[oldRoot.id].selections).toEqual(tree);expect(c.selections.some(row=>row.id===oldRoot.id)).toBe(false);}
  const restored=roundtrip(c);restored.profile.enabledSources=['PHB'];restored.profile.disabledEntries=[];restored.automation!.enabled=true;if(mode==='replace'||mode==='forget')setSheetChoiceSlot(restored,choiceId,0,find('Otherworldly Leap').id,[]);sync(restored,[]);expect(root(restored,'Otherworldly Leap').id).toBe(oldRoot.id);expect(child(restored,'Otherworldly Leap').id).toBe(oldSpell.id);expect(spellPayments(restored,oldSpell.id).options.map(option=>option.id)).toEqual(['free']);expect(restored.runtime.resources).toEqual(resources);expect(restored.selections.find(row=>row.id==='manual-spell')).toEqual(manual);validateCharacter(restored);
 });
 it('exposes self-only and component boundaries without waiving unknown components or simulating movement/conversation',()=>{
  const {c,entries}=learnedThree(),issues=planSourceSpells(c,entries).issues;
  for(const row of level9Invocations){const boundary=issues.find(issue=>issue.selectionId===root(c,row.english).id&&issue.id.includes('invocation-boundary'))!;expect(boundary.message).toContain('仍手动处理');expect(boundary.message.includes('仅对自身')).toBe(row.self);expect(boundary.message).toContain(row.self?'不消耗法术位和材料成分':'不豁免材料成分');expect(boundary.message).toContain('言语、姿势成分');}
 });
});
