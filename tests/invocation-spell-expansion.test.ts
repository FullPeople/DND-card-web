import {describe,expect,it} from 'vitest';
import {invocationFixture,learn,sync} from './fixtures/invocationFixture';
import {invocationRule} from '../src/core/automation/invocations';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {planSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest,spellPayments} from '../src/core/automation/actions';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter,validateCharacter} from '../src/core/validation';
import type {Character} from '../src/core/model';
import {removeSelection} from '../src/core/sheet';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';

const additions=[
 {name:'Beast Speech',spell:'Speak with Animals',reference:'Speak with Animals|PHB'},
 {name:'Mask of Many Faces',spell:'Disguise Self',reference:'Disguise Self|PHB'},
 {name:'Misty Visions',spell:'Silent Image',reference:'Silent Image|PHB'},
] as const;
const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
const root=(c:Character,name:string)=>c.selections.find(row=>row.entry.english===name&&row.grantKey?.startsWith('choice:'))!;
const child=(c:Character,name:string)=>c.selections.find(row=>row.parentId===root(c,name)?.id&&row.grantKey?.startsWith('source-spell:'))!;

// Original metadata fixtures, not upstream rules text. The frozen regression in
// invocations.test.ts independently checks the exact source inputs and entries.
describe.each(additions)('$name reviewed at-will payment',({name,spell,reference})=>{
 it('recognizes only the reviewed PHB declaration and grants its exact free spell',()=>{
  const {c,entries,find,choiceId}=invocationFixture();
  expect(invocationRule(find(name))).toMatchObject({reference:`${name}|PHB`,mechanism:'spell',spellReference:reference});
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(option=>option.value===find(name).id)?.grant).toBeDefined();
  learn(c,entries,find(name));
  expect(root(c,name)).toBeDefined();
  expect(child(c,name).entry.english).toBe(spell);
  expect(child(c,name).entry.source).toBe('PHB');
  expect(child(c,name).entry.edition).toBe('2014');
  expect(spellPayments(c,child(c,name).id).options).toMatchObject([{id:'free',level:1,cost:0,available:true}]);
 });
});

const spellInvocations=[...additions,{name:'Eldritch Sight',spell:'Detect Magic'},{name:'Armor of Shadows',spell:'Mage Armor'}];
describe.each(spellInvocations)('$name exact child identity',({name,spell})=>{
 it.each(['canonical-name','source','edition','copy','unresolved','level','effects','choices'] as const)('does not authorize a same-label catalog spell with altered %s',mode=>{
  const {c,entries,find}=invocationFixture(),entry=find(spell);
  if(mode==='canonical-name'){entry.english='Unreviewed Spell';entry.raw.ENG_name='Unreviewed Spell';}
  if(mode==='source')entry.source='TCE';
  if(mode==='edition')entry.edition='2024';
  if(mode==='copy')entry.raw._copy={name:entry.name,source:'PHB'};
  if(mode==='unresolved')entry.raw._unresolvedParent=true;
  if(mode==='level')entry.raw.level=2;
  if(mode==='effects')entry.effects=[{op:'add',target:'ac',value:1}];
  if(mode==='choices')entry.choices=[{id:'unreviewed',label:'Unreviewed',count:1,options:['one']}];
  learn(c,entries,find(name));
  const grants=planSourceSpells(c,entries).grants.filter(row=>row.owner.id===root(c,name).id);
  expect(grants.some(row=>row.config.sourceGrant?.active&&row.config.sourceGrant.usage==='free')).toBe(false);
  const row=child(c,name);
  if(row)expect(spellPayments(c,row.id).options).toEqual([]);
 });
 it.each(['canonical-name','source','edition','copy','unresolved','level','effects','choices','parent','grant-key'] as const)('refuses actual free casting after child %s changes, without mutation',mode=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const row=child(c,name);
  if(mode==='canonical-name'){row.entry.english='Unreviewed Spell';row.entry.raw.ENG_name='Unreviewed Spell';}
  if(mode==='source')row.entry.source='TCE';
  if(mode==='edition')row.entry.edition='2024';
  if(mode==='copy')row.entry.raw._copy={name:row.entry.name,source:'PHB'};
  if(mode==='unresolved')row.entry.raw._unresolvedParent=true;
  if(mode==='level')row.entry.raw.level=2;
  if(mode==='effects')row.entry.effects=[{op:'add',target:'ac',value:1}];
  if(mode==='choices')row.entry.choices=[{id:'unreviewed',label:'Unreviewed',count:1,options:['one']}];
  if(mode==='parent')row.parentId='warlock';
  if(mode==='grant-key')row.grantKey='source-spell:0/innate/_/_/unrelated';
  const before=JSON.stringify(c);
  expect(spellPayments(c,row.id).options).toEqual([]);
  expect(performSpellAction(c,spellActionRequest(c,row.id,'free','reject-child'))).toMatchObject({status:'rejected'});
  expect(JSON.stringify(c)).toBe(before);
 });
});

describe.each(additions)('$name usable learning lifecycle',({name,spell})=>{
 it('repeats actual free casting across save/reopen, without consuming slots, changing effects, or upgrading a manual same-name spell',()=>{
  const {c,entries,find}=invocationFixture();
  c.identity.description='Manual appearance';c.notes='Manual adjudication';c.sheetBonuses={ac:3};
  c.runtime.hp=2;c.runtime.resources.manual={current:1,max:7};c.runtime.resources['pact-slot:3']={current:0,max:2};c.runtime.resources['spell-slot:1']={current:2,max:4};
  c.selections.push({id:'manual-spell',entry:structuredClone(find(spell)),quantity:1,level:1,equipped:false});
  setSpecialSpell(c,'manual-spell',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-spell',1);
  const manual=structuredClone(c.selections.at(-1)),manualSettings=structuredClone(c.spellSettings!.special!['manual-spell']),resources=structuredClone(c.runtime.resources);
  const mechanical=(value:Character)=>{const result=evaluate(value);return {ac:result.ac,speed:result.speed,maxHp:result.maxHp,abilities:result.abilities,skills:result.skills,saves:result.saves};};
  const baseline=mechanical(c);learn(c,entries,find(name));const ids=[root(c,name).id,child(c,name).id];
  expect(mechanical(c)).toEqual(baseline);
  const saved=roundtrip(c);
  for(let attempt=0;attempt<3;attempt++){
   sync(saved,[]);const row=child(saved,name),before=JSON.stringify(saved);
   expect([root(saved,name).id,row.id]).toEqual(ids);
   expect(spellPayments(saved,row.id).options).toMatchObject([{id:'free',level:1,cost:0,available:true}]);
   expect(spellPayments(saved,'manual-spell').options).toEqual([]);
   expect(planSourceSpells(saved).issues.some(issue=>issue.message.includes('仍手动处理'))).toBe(true);
   expect(JSON.stringify(saved)).toBe(before);
   const request=spellActionRequest(saved,row.id,'free',`repeat-${attempt}`),result=performSpellAction(saved,request);
   expect(result).toMatchObject({status:'applied',receipt:{level:1,mode:'cast',selectionId:row.id}});
   if(result.status==='applied')expect(result.receipt.resourceId).toBeUndefined();
   const after=JSON.stringify(saved);expect(performSpellAction(saved,request).status).toBe('duplicate');expect(JSON.stringify(saved)).toBe(after);
  }
  const reopened=roundtrip(saved);sync(reopened,[]);
  expect(reopened.runtime.automationActions?.sequence).toBe(3);expect(reopened.runtime.resources).toEqual(resources);
  expect(reopened.selections.find(row=>row.id==='manual-spell')).toEqual(manual);expect(reopened.spellSettings!.special!['manual-spell']).toEqual(manualSettings);
  expect(mechanical(reopened)).toEqual(baseline);expect(reopened.identity.description).toBe('Manual appearance');expect(reopened.notes).toBe('Manual adjudication');expect(reopened.runtime.hp).toBe(2);validateCharacter(reopened);
 });
 it.each(['source','owner-disabled','feature-disabled','invocation-disabled','level','forget','replace'] as const)('revokes %s grants, retains exact saved IDs and manual resources, and restores without catalog',mode=>{
  const {c,entries,find,choiceId}=invocationFixture();learn(c,entries,find(name));
  const invocation=root(c,name),granted=child(c,name),feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;
  c.selections.push({id:'manual-spell',entry:structuredClone(find(spell)),quantity:1,level:1,equipped:false});
  c.selections.push({id:'manual-child',entry:structuredClone(find('Mage Armor')),parentId:invocation.id,quantity:1,level:1,equipped:false});
  setSpecialSpell(c,'manual-child',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-child',1);
  const tree=structuredClone(c.selections.filter(row=>row.id===invocation.id||row.parentId===invocation.id)),manual=structuredClone(c.selections.find(row=>row.id==='manual-spell')),resource=specialSpellResource('manual-child',c);
  if(mode==='source')c.profile.enabledSources=[];
  if(mode==='owner-disabled')c.profile.disabledEntries=[c.selections[0].entry.id];
  if(mode==='feature-disabled')c.profile.disabledEntries=[feature.entry.id];
  if(mode==='invocation-disabled')c.profile.disabledEntries=[invocation.entry.id];
  if(mode==='level')c.selections[0].level=1;
  if(mode==='forget')setSheetChoiceSlot(c,choiceId,0,undefined,entries);
  if(mode==='replace')setSheetChoiceSlot(c,choiceId,0,find('Eldritch Sight').id,entries);
  sync(c,entries);
  expect(c.classChoiceArchive?.[invocation.id].selections).toEqual(tree);expect(c.selections.some(row=>row.id===invocation.id||row.id===granted.id)).toBe(false);
  expect(spellPayments(c,granted.id).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,granted.id,'free','revoked'))).toMatchObject({status:'rejected'});
  expect(c.selections.find(row=>row.id==='manual-spell')).toEqual(manual);expect(c.runtime.resources[resource].current).toBe(1);
  const restored=roundtrip(c);restored.profile.enabledSources=['PHB'];restored.profile.disabledEntries=[];restored.selections[0].level=5;
  if(mode==='forget'||mode==='replace')setSheetChoiceSlot(restored,choiceId,0,find(name).id,[]);
  sync(restored,[]);
  expect(JSON.parse(JSON.stringify(restored.selections.filter(row=>tree.some(old=>old.id===row.id))))).toEqual(JSON.parse(JSON.stringify(tree)));
  expect(spellPayments(restored,granted.id).options.map(option=>option.id)).toEqual(['free']);
  expect(performSpellAction(restored,spellActionRequest(restored,granted.id,'free','restored'))).toMatchObject({status:'applied'});
  expect(restored.runtime.resources[resource].current).toBe(1);expect(restored.selections.find(row=>row.id==='manual-spell')).toEqual(manual);validateCharacter(restored);
 });
 it('blocks automation-off casts and restores the same spell after reopening, without replenishment',()=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const invocation=root(c,name),granted=child(c,name);c.runtime.resources.manual={current:0,max:4};
  c.automation!.enabled=false;sync(c,entries);expect(spellPayments(c,granted.id).options).toEqual([]);
  const before=JSON.stringify(c);expect(performSpellAction(c,spellActionRequest(c,granted.id,'free','disabled'))).toMatchObject({status:'rejected'});expect(JSON.stringify(c)).toBe(before);
  const restored=roundtrip(c);restored.automation!.enabled=true;sync(restored,[]);expect(root(restored,name).id).toBe(invocation.id);expect(child(restored,name).id).toBe(granted.id);expect(spellPayments(restored,granted.id).options.map(option=>option.id)).toEqual(['free']);expect(restored.runtime.resources.manual).toEqual({current:0,max:4});validateCharacter(restored);
 });
 it.each(['feature','class'] as const)('deleting its %s revokes only owned grants and preserves a manual same-name spell',target=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const invocation=root(c,name),granted=child(c,name);
  c.selections.push({id:'manual-spell',entry:structuredClone(find(spell)),quantity:1,level:1,equipped:false});const manual=structuredClone(c.selections.at(-1));
  removeSelection(c,target==='class'?'warlock':c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.id);sync(c,entries);
  expect(c.selections.some(row=>row.id===invocation.id||row.id===granted.id)).toBe(false);expect(spellPayments(c,granted.id).options).toEqual([]);expect(c.selections.find(row=>row.id==='manual-spell')).toEqual(manual);expect(spellPayments(c,'manual-spell').options).toEqual([]);validateCharacter(c);
 });
 it('rejects another ID for the same learned identity and preserves old duplicate answers without duplicate grants',()=>{
  const {c,entries,find,choiceId}=invocationFixture(),original=find(name),duplicate={...structuredClone(original),id:'different-import-id'};entries.push(duplicate);learn(c,entries,original);
  const before=JSON.stringify(c);expect(()=>setSheetChoiceSlot(c,choiceId,1,duplicate.id,entries)).toThrow('同来源');expect(JSON.stringify(c)).toBe(before);
  c.answers[choiceId][1]=duplicate.id;c.classChoiceSnapshots![duplicate.id]=duplicate;const answers=structuredClone(c.answers[choiceId]);sync(c,entries);
  expect(c.answers[choiceId]).toEqual(answers);expect(c.selections.filter(row=>row.entry.english===name)).toHaveLength(1);expect(c.selections.filter(row=>row.grantKey?.startsWith('source-spell:'))).toHaveLength(1);validateCharacter(c);
 });
});

describe.each(additions)('$name source-owned qualification gates',({name})=>{
 it.each(['source','edition','copy','prerequisite','spell-payload','effects','feature-type','unknown-field'] as const)('does not reinterpret altered invocation %s as free casting',mode=>{
  const {c,entries,find}=invocationFixture(),entry=structuredClone(find(name));
  if(mode==='source')entry.source='TCE';if(mode==='edition')entry.edition='2024';if(mode==='copy')entry.raw._copy={};if(mode==='prerequisite')entry.raw.prerequisite=[{level:5}];
  if(mode==='spell-payload')entry.raw.additionalSpells[0].innate._=['法师护甲'];if(mode==='effects')entry.effects=[{op:'add',target:'ac',value:2}];if(mode==='feature-type')entry.raw.featureType=['EI','AI'];if(mode==='unknown-field')entry.raw.unknownMechanism=true;
  expect(invocationRule(entry)).toBeUndefined();c.selections.push({id:'manual-invocation',entry,quantity:1,level:1,equipped:false});
  const grants=planSourceSpells(c,entries).grants.filter(row=>row.owner.id==='manual-invocation');expect(grants).toHaveLength(1);expect(grants[0].config.sourceGrant?.usage).toBe('check');
 });
 it.each(['class-source','class-edition','class-copy','progression','source-feature','no-answer','wrong-parent','wrong-choice'] as const)('rejects actual casting when the %s ownership gate fails',mode=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const invocation=root(c,name),granted=child(c,name),owner=c.selections[0];
  if(mode==='class-source')owner.entry.source='XPHB';if(mode==='class-edition')owner.entry.edition='2024';if(mode==='class-copy')owner.entry.raw._copy={};if(mode==='progression')owner.entry.raw.optionalfeatureProgression[0].progression=[0,2];if(mode==='source-feature')c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.english='Unreviewed Feature';
  if(mode==='no-answer')c.answers[invocation.requirementId!]=[];if(mode==='wrong-parent')invocation.parentId='warlock';if(mode==='wrong-choice')invocation.requirementId='warlock:class-optional:1';
  const before=JSON.stringify(c);expect(spellPayments(c,granted.id).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,granted.id,'free','bad-owner'))).toMatchObject({status:'rejected'});expect(JSON.stringify(c)).toBe(before);
 });
 it('keeps an unknown same-payload invocation record-only rather than guessing at its abilities',()=>{
  const {c,entries,find,choiceId}=invocationFixture(),unknown={...structuredClone(find(name)),id:'unknown-invocation',name:'Unreviewed Invocation',english:'Unreviewed Invocation'};unknown.raw.ENG_name=unknown.english;entries.push(unknown);
  learn(c,entries,unknown);expect(c.answers[choiceId]).toContain(unknown.id);expect(c.selections.some(row=>row.entry.id===unknown.id)).toBe(false);
  c.selections.push({id:'manual-unknown',entry:unknown,quantity:1,level:1,equipped:false});const grants=planSourceSpells(c,entries).grants.filter(row=>row.owner.id==='manual-unknown');expect(grants).toHaveLength(1);expect(grants[0].config.sourceGrant?.usage).toBe('check');
 });
});

describe.each(spellInvocations)('$name canonical qualification remains independent of display labels',({name,spell})=>{
 it('accepts a renamed display label on the same reviewed spell',()=>{
  const {c,entries,find}=invocationFixture();find(spell).name='My spell display label';learn(c,entries,find(name));
  expect(child(c,name)?.entry.english).toBe(spell);expect(spellPayments(c,child(c,name).id).options.map(option=>option.id)).toEqual(['free']);
 });
 it('does not let a same-label unreviewed spell hide the one canonical reviewed spell',()=>{
  const {c,entries,find}=invocationFixture(),lookalike={...structuredClone(find(spell)),id:'lookalike-spell',english:'Unreviewed Spell'};lookalike.raw.ENG_name=lookalike.english;entries.push(lookalike);learn(c,entries,find(name));
  expect(child(c,name)?.entry.id).toBe(find(spell).id);expect(spellPayments(c,child(c,name).id).options.map(option=>option.id)).toEqual(['free']);
 });
 it('does not authorize a forged parent learning grant key',()=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const granted=child(c,name);root(c,name).grantKey='choice:forged';
  const before=JSON.stringify(c);expect(spellPayments(c,granted.id).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,granted.id,'free','forged-parent'))).toMatchObject({status:'rejected'});expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['raw-english','raw-source','raw-edition','raw-category'] as const)('refuses a spell whose %s contradicts its normalized identity',mode=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find(name));const granted=child(c,name);
  if(mode==='raw-english')granted.entry.raw.ENG_name='Unreviewed Spell';if(mode==='raw-source')granted.entry.raw.source='XPHB';if(mode==='raw-edition')granted.entry.raw.edition='one';if(mode==='raw-category')granted.entry.raw._category='feat';
  const before=JSON.stringify(c);expect(spellPayments(c,granted.id).options).toEqual([]);expect(performSpellAction(c,spellActionRequest(c,granted.id,'free','raw-identity'))).toMatchObject({status:'rejected'});expect(JSON.stringify(c)).toBe(before);
 });
});
