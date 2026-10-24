import {describe,expect,it} from 'vitest';
import {finalAtWillInvocations,invocationAtWillFinalFixture} from './fixtures/invocationAtWillFinalFixture';
import {learn,sync} from './fixtures/invocationFixture';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {invocationRule} from '../src/core/automation/invocations';
import {planSourceSpells} from '../src/core/automation/sourceSpells';
import {exportCharacter} from '../src/core/export';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {evaluate} from '../src/core/engine';
import type {Character} from '../src/core/model';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';

const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
const root=(c:Character,name:string)=>c.selections.find(row=>row.entry.english===name&&row.grantKey?.startsWith('choice:'))!;
const child=(c:Character,name:string)=>c.selections.find(row=>row.parentId===root(c,name)?.id&&row.grantKey?.startsWith('source-spell:'))!;
function learned(english:string,at=15){const fixture=invocationAtWillFinalFixture(at);learn(fixture.c,fixture.entries,fixture.find(english));return {...fixture,root:root(fixture.c,english),child:child(fixture.c,english)};}
const rejectUnchanged=(c:Character,request:ReturnType<typeof spellActionRequest>)=>{const before=JSON.stringify(c);expect(performSpellAction(c,request).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);};

describe.each(finalAtWillInvocations)('$english reviewed at-will grant',({english,spell,level,required,self})=>{
 it('offers learning at its own Warlock level and grants exactly its reviewed free spell',()=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture(required);
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(option=>option.value===find(english).id)?.grant).toBeDefined();
  learn(c,entries,find(english));const root=c.selections.find(row=>row.entry.english===english&&row.grantKey?.startsWith('choice:'));
  expect(root).toBeDefined();const child=c.selections.find(row=>row.parentId===root!.id&&row.grantKey?.startsWith('source-spell:'));
  expect(child?.entry.english).toBe(spell);const options=spellPayments(c,child!.id).options;
  expect(options).toMatchObject([{id:'free',level,cost:0,available:true}]);expect(options[0].label.includes('仅自身')).toBe(self);
 });
});

describe.each(finalAtWillInvocations)('$english current qualification and identity',({english,spell,level,required})=>{
 it.each(['other-class','another-warlock'] as const)('does not borrow levels from %s below its own exact threshold',mode=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture(required-1),other=structuredClone(c.selections[0]);other.id='other';other.level=15;
  if(mode==='other-class'){other.entry.id='fighter';other.entry.english='Fighter';other.entry.name='Warlock';other.entry.raw.ENG_name='Fighter';other.entry.raw.optionalfeatureProgression=[];}
  c.selections.push(other);const before=JSON.stringify(c);expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===find(english).id)?.grant).toBeUndefined();expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['absent-or-added','numeric','wrong-level','other-class','extra-key','or-alternative','empty','null'] as const)('rejects altered prerequisite %s instead of guessing',mode=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture(),entry=find(english);
  if(mode==='absent-or-added'){if(required===2)entry.raw.prerequisite=[{level:{level:2,class:{ENG_name:'Warlock',name:'魔契师'}}}];else delete entry.raw.prerequisite;}
  if(mode==='numeric')entry.raw.prerequisite=[{level:required}];if(mode==='wrong-level')entry.raw.prerequisite=[{level:{level:required+1,class:{ENG_name:'Warlock',name:'魔契师'}}}];if(mode==='other-class')entry.raw.prerequisite=[{level:{level:required,class:{ENG_name:'Fighter',name:'战士'}}}];if(mode==='extra-key')entry.raw.prerequisite=[{level:{level:required,class:{ENG_name:'Warlock',name:'魔契师',source:'PHB'}}}];if(mode==='or-alternative')entry.raw.prerequisite=[...(entry.raw.prerequisite||[]),{}];if(mode==='empty')entry.raw.prerequisite=[];if(mode==='null')entry.raw.prerequisite=null;
  expect(invocationRule(entry)).toBeUndefined();c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:structuredClone(entry)};sync(c,entries);expect(root(c,english)).toBeUndefined();
 });
 it.each(['english','raw-english','source','raw-source','edition','copy','payload','extra-mechanics','effects','choices'] as const)('keeps an invocation with altered %s record-only',mode=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture(),entry=find(english);
  if(mode==='english')entry.english='Unreviewed';if(mode==='raw-english')entry.raw.ENG_name='Unreviewed';if(mode==='source')entry.source='XPHB';if(mode==='raw-source')entry.raw.source='XPHB';if(mode==='edition')entry.edition='2024';if(mode==='copy')entry.raw._copy={};if(mode==='payload')entry.raw.additionalSpells=[{innate:{_:['侦测魔法']}}];if(mode==='extra-mechanics')entry.raw.maxTempHp=true;if(mode==='effects')entry.effects=[{op:'add',target:'ac',value:1}];if(mode==='choices')entry.choices=[{id:'unknown',label:'unknown',count:1,options:['athletics']}];
  expect(invocationRule(entry)).toBeUndefined();expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===entry.id)?.grant).toBeUndefined();
 });
 it.each(['raw-english','raw-source','kind','raw-edition','copy','effects','choices','grant-key'] as const)('rejects source feature %s tampering before synchronization',mode=>{
  const {c,child}=learned(english),feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!,request=spellActionRequest(c,child.id,'free','source-feature-forgery');
  if(mode==='raw-english')feature.entry.raw.ENG_name='Other';if(mode==='raw-source')feature.entry.raw.source='XPHB';if(mode==='kind')feature.entry.kind='feat';if(mode==='raw-edition')feature.entry.raw.edition='one';if(mode==='copy')feature.entry.raw._copy={};if(mode==='effects')feature.entry.effects=[{op:'add',target:'ac',value:1}];if(mode==='choices')feature.entry.choices=[{id:'unknown',label:'unknown',count:1,options:['athletics']}];if(mode==='grant-key')feature.grantKey='ref:forged';
  const before=JSON.stringify(c);expect(spellPayments(c,child.id).options).toEqual([]);expect(JSON.stringify(c)).toBe(before);rejectUnchanged(c,request);
 });
 it.each(['english','raw-english','source','raw-source','edition','raw-edition','copy','level','parent','grant-key'] as const)('rejects child %s tampering despite a formerly offered free cast',mode=>{
  const {c,child}=learned(english),request=spellActionRequest(c,child.id,'free','child-forgery');
  if(mode==='english')child.entry.english='Unreviewed';if(mode==='raw-english')child.entry.raw.ENG_name='Unreviewed';if(mode==='source')child.entry.source='XPHB';if(mode==='raw-source')child.entry.raw.source='XPHB';if(mode==='edition')child.entry.edition='2024';if(mode==='raw-edition')child.entry.raw.edition='one';if(mode==='copy')child.entry.raw._copy={};if(mode==='level')child.entry.raw.level=level===1?2:1;if(mode==='parent')child.parentId='warlock';if(mode==='grant-key')child.grantKey='source-spell:forged';
  expect(spellPayments(c,child.id).options).toEqual([]);rejectUnchanged(c,request);
 });
 it.each(['raw-english','raw-source','source','edition','raw-edition','copy','level','answer','parent','grant-key','automation'] as const)('rejects current owner/learning %s before synchronization',mode=>{
  const {c,root,child}=learned(english),owner=c.selections[0],request=spellActionRequest(c,child.id,'free','owner-forgery');
  if(mode==='raw-english')owner.entry.raw.ENG_name='Fighter';if(mode==='raw-source')owner.entry.raw.source='XPHB';if(mode==='source')owner.entry.source='XPHB';if(mode==='edition')owner.entry.edition='2024';if(mode==='raw-edition')owner.entry.raw.edition='one';if(mode==='copy')owner.entry.raw._copy={};if(mode==='level')owner.level=required-1;if(mode==='answer')c.answers[root.requirementId!]=[];if(mode==='parent')root.parentId='warlock';if(mode==='grant-key')root.grantKey='choice:forged';if(mode==='automation')c.automation!.enabled=false;
  expect(spellPayments(c,child.id).options).toEqual([]);rejectUnchanged(c,request);
 });
 it('never trusts cached upcast metadata or substitutes a slot/limited-use payment',()=>{
  const {c,child}=learned(english);c.runtime.resources['pact-slot:5']={max:3,current:3};c.runtime.resources['spell-slot:9']={max:1,current:1};c.spellSettings!.special![child.id].sourceGrant!.castLevel=9;
  const before=JSON.stringify(c);expect(spellPayments(c,child.id).options).toMatchObject([{id:'free',level}]);expect(JSON.stringify(c)).toBe(before);for(const payment of ['source','invocation-pact','slot:pact-slot:5','slot:spell-slot:9'])rejectUnchanged(c,spellActionRequest(c,child.id,payment,payment));expect(performSpellAction(c,spellActionRequest(c,child.id,'free','canonical'))).toMatchObject({status:'applied',receipt:{level}});
 });
 it('allows harmless display labels, reserves canonical aliases and rejects canonical lookalike spells',()=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture();find(english).name='My invocation';find(spell).name='My spell';const alias={...structuredClone(find(english)),id:'alias'},lookalike={...structuredClone(find(spell)),id:'lookalike',english:'Unreviewed'};lookalike.raw.ENG_name='Unreviewed';entries.push(alias,lookalike);learn(c,entries,find(english));expect(child(c,english).entry.id).toBe(find(spell).id);
  const before=JSON.stringify(c);expect(()=>setSheetChoiceSlot(c,choiceId,1,alias.id,entries)).toThrow('同来源');expect(JSON.stringify(c)).toBe(before);c.answers[choiceId].push(alias.id);c.classChoiceSnapshots![alias.id]=alias;sync(c,entries);expect(c.selections.filter(row=>row.entry.english===english)).toHaveLength(1);
 });
 it('does not adopt a manual invocation or its source-spell links',()=>{
  const {c,entries,find,choiceId}=invocationAtWillFinalFixture();c.selections.push({id:'manual-invocation',entry:{...structuredClone(find(english)),id:'manual-import'},level:1,quantity:1,equipped:false});const manual=structuredClone(c.selections.at(-1));expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow('手工');sync(c,entries);expect(c.selections.find(row=>row.id==='manual-invocation')).toEqual(manual);expect(root(c,english)).toBeUndefined();for(const row of c.selections.filter(row=>row.parentId==='manual-invocation'))expect(spellPayments(c,row.id).options).toEqual([]);
 });
});

describe.each(finalAtWillInvocations)('$english preserved lifecycle',({english,spell,required,level,self,materialWaived})=>{
 it.each(['source','owner','feature','invocation','downgrade','forget','replace','automation'] as const)('retains exact records and manual child state through %s, native save and restoration without catalog',mode=>{
  const {c,entries,find,choiceId,root:grant,child:granted}=learned(english,required);
  c.selections.push({id:'manual-child',entry:structuredClone(find('Detect Magic')),parentId:grant.id,level:1,quantity:1,equipped:false});setSpecialSpell(c,'manual-child',{mode:'uses',max:4});changeSpecialSpellUses(c,'manual-child',1);
  const key=specialSpellResource('manual-child',c),tree=structuredClone(c.selections.filter(row=>row.id===grant.id||row.parentId===grant.id)),resources=structuredClone(c.runtime.resources),answer=structuredClone(c.answers[choiceId]),request=spellActionRequest(c,granted.id,'free','before-suspend');
  if(mode==='source')c.profile.enabledSources=[];if(mode==='owner')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='feature')c.profile.disabledEntries=[c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.id];if(mode==='invocation')c.profile.disabledEntries=[grant.entry.id];if(mode==='downgrade')c.selections[0].level=required-1;if(mode==='forget')setSheetChoiceSlot(c,choiceId,0,undefined,entries);if(mode==='replace')setSheetChoiceSlot(c,choiceId,0,find('Eldritch Sight').id,entries);if(mode==='automation')c.automation!.enabled=false;
  expect(spellPayments(c,granted.id).options).toEqual([]);rejectUnchanged(c,request);sync(c,entries);
  if(mode!=='automation'){expect(c.classChoiceArchive?.[grant.id].selections).toEqual(tree);expect(c.selections.some(row=>row.id===grant.id)).toBe(false);}
  if(mode==='downgrade'){expect(c.answers[choiceId]).toEqual(answer);if(required===15)expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.count).toBe(6);}
  const saved=roundtrip(c);saved.profile.enabledSources=['PHB'];saved.profile.disabledEntries=[];saved.selections[0].level=required;saved.automation!.enabled=true;if(mode==='forget'||mode==='replace')setSheetChoiceSlot(saved,choiceId,0,find(english).id,[]);sync(saved,[]);
  expect(JSON.parse(JSON.stringify(saved.selections.filter(row=>row.id===grant.id||row.parentId===grant.id)))) .toEqual(JSON.parse(JSON.stringify(tree)));expect(saved.runtime.resources).toEqual(resources);expect(saved.runtime.resources[key].current).toBe(1);expect(spellPayments(saved,granted.id).options).toMatchObject([{id:'free',level}]);validateCharacter(saved);
 });
 it('parks the complete tree during a disabled-automation downgrade and restores the original IDs without replenishing manual uses',()=>{
  const {c,entries,find,root:grant,child:granted}=learned(english,required);c.selections.push({id:'manual-child',entry:structuredClone(find('Detect Magic')),parentId:grant.id,level:1,quantity:1,equipped:false});setSpecialSpell(c,'manual-child',{mode:'uses',max:4});changeSpecialSpellUses(c,'manual-child',1);const resources=structuredClone(c.runtime.resources);
  c.automation!.enabled=false;c.selections[0].level=required-1;sync(c,entries);expect(c.classChoiceArchive?.[grant.id].selections.map(row=>row.id)).toEqual([grant.id,granted.id,'manual-child']);const saved=roundtrip(c);saved.selections[0].level=required;saved.automation!.enabled=true;sync(saved,[]);expect(root(saved,english).id).toBe(grant.id);expect(child(saved,english).id).toBe(granted.id);expect(saved.runtime.resources).toEqual(resources);validateCharacter(saved);
 });
 it('keeps source-qualified saved snapshots rather than upgrading from later same-ID catalog payloads',()=>{
  const {c,entries,find,root:grant,child:granted}=learned(english);const original=structuredClone(grant.entry);find(english).raw.additionalSpells=[{innate:{_:['侦测魔法']}}];find(spell).raw.level=9;const saved=roundtrip(c);sync(saved,entries);expect(root(saved,english).entry).toEqual(original);expect(child(saved,english).id).toBe(granted.id);expect(spellPayments(saved,granted.id).options).toMatchObject([{id:'free',level}]);
 });
 it('makes self/material/manual-effect boundaries visible without implying unreviewed component exemptions',()=>{
  const {c,entries,root:grant}=learned(english),issue=planSourceSpells(c,entries).issues.find(row=>row.selectionId===grant.id&&row.id.includes('invocation-boundary'))!;
  expect(issue.message.includes('仅对自身')).toBe(self);expect(issue.message.includes('不消耗法术位和材料成分')).toBe(materialWaived);expect(issue.message).toContain('言语、姿势成分');expect(issue.message).toContain('仍手动处理');
  if(english==='Fiendish Vigor'){expect(issue.message).toContain('1d4+4');expect(issue.message).toContain('不自动增加或替换临时生命值');}
  if(english==='Master of Myriad Forms'){expect(issue.message).toContain('本法术无材料成分');expect(issue.message).toContain('不自动改变形态或角色数值');}
  if(english==='Visions of Distant Realms'){expect(issue.message).toContain('不豁免材料成分');expect(issue.message).toContain('30 尺施法距离');expect(issue.message).toContain('不自动创建或移动传感器');}
 });
});

it('repeats all three free casts through native export/reopen without temp HP, appearance, statistics, manual spells or resource changes',()=>{
 const {c,entries,find}=invocationAtWillFinalFixture();c.notes='Manual sensory adjudication';c.identity.description='Manual appearance';c.runtime.hp=2;c.runtime.tempHp=7;c.sheetBonuses={ac:3};c.runtime.resources.manual={current:1,max:7};c.runtime.resources['pact-slot:5']={current:0,max:3};c.runtime.resources['spell-slot:4']={current:1,max:2};
 for(const row of finalAtWillInvocations){const id=`manual-${row.level}`;c.selections.push({id,entry:structuredClone(find(row.spell)),level:1,quantity:1,equipped:false});setSpecialSpell(c,id,{mode:'uses',max:4});changeSpecialSpellUses(c,id,2);}
 const manual=structuredClone(c.selections.filter(row=>row.id.startsWith('manual-'))),settings=structuredClone(c.spellSettings!.special),resources=structuredClone(c.runtime.resources),baseline=evaluate(c);for(const [slot,row] of finalAtWillInvocations.entries())learn(c,entries,find(row.english),slot);
 const ids=finalAtWillInvocations.map(row=>[root(c,row.english).id,child(c,row.english).id]);let saved=roundtrip(c);
 for(let attempt=0;attempt<3;attempt++){
  sync(saved,[]);expect(finalAtWillInvocations.map(row=>[root(saved,row.english).id,child(saved,row.english).id])).toEqual(ids);
  for(const row of finalAtWillInvocations){const granted=child(saved,row.english),before=JSON.stringify(saved),request=spellActionRequest(saved,granted.id,'free',`repeat-${attempt}-${row.level}`),parallel=spellActionRequest(saved,granted.id,'free',`parallel-${attempt}-${row.level}`);expect(spellPayments(saved,granted.id).options).toMatchObject([{id:'free',level:row.level,cost:0}]);expect(JSON.stringify(saved)).toBe(before);expect(performSpellAction(saved,request)).toMatchObject({status:'applied',receipt:{level:row.level}});const after=JSON.stringify(saved);expect(performSpellAction(saved,request).status).toBe('duplicate');expect(JSON.stringify(saved)).toBe(after);rejectUnchanged(saved,parallel);expect(spellPayments(saved,`manual-${row.level}`).options).toEqual([]);}
  saved=roundtrip(saved);
 }
 expect(saved.runtime.resources).toEqual(resources);expect(saved.selections.filter(row=>row.id.startsWith('manual-'))).toEqual(manual);for(const row of manual)expect(saved.spellSettings!.special![row.id]).toEqual(settings![row.id]);for(const key of ['ac','speed','maxHp','abilities','skills','saves'] as const)expect(evaluate(saved)[key]).toEqual(baseline[key]);expect(saved.notes).toBe('Manual sensory adjudication');expect(saved.identity.description).toBe('Manual appearance');expect(saved.runtime.hp).toBe(2);expect(saved.runtime.tempHp).toBe(7);expect(saved.runtime.automationActions?.sequence).toBe(9);validateCharacter(saved);
});

import {invocationFixture} from './fixtures/invocationFixture';
import {invocationLevel9Fixture,level9Invocations} from './fixtures/invocationLevel9Fixture';
import {invocationDualPaymentFixture,dualInvocations} from './fixtures/invocationDualPaymentFixture';
const legacyCases=[
 ...['Eldritch Sight','Armor of Shadows','Beast Speech','Mask of Many Faces','Misty Visions'].map(english=>({english,fixture:invocationFixture,payment:'free'})),
 ...level9Invocations.map(({english})=>({english,fixture:invocationLevel9Fixture,payment:'free'})),
 ...dualInvocations.map(({english})=>({english,fixture:invocationDualPaymentFixture,payment:'invocation-pact'})),
];
it.each(legacyCases)('preserves $english payment but rejects a forged shared source feature immediately',({english,fixture,payment})=>{
 const {c,entries,find}=fixture();learn(c,entries,find(english));const spell=child(c,english);expect(spellPayments(c,spell.id).options.map(option=>option.id)).toEqual([payment]);
 const request=spellActionRequest(c,spell.id,payment,'legacy-source-forgery'),feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;feature.entry.raw.ENG_name='Other';expect(spellPayments(c,spell.id).options).toEqual([]);rejectUnchanged(c,request);
});
it('preserves shared-source skills and revokes a forged source at sync without changing manual proficiency',()=>{
 const {c,entries,find}=invocationFixture();c.proficiencies={persuasion:true};learn(c,entries,find('Beguiling Influence'));const feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;expect(evaluate(c).skills.deception.proficient).toBe(true);feature.entry.raw.ENG_name='Other';sync(c,entries);const before=JSON.stringify(c);expect(evaluate(c).skills.deception.proficient).toBe(false);expect(evaluate(c).skills.persuasion.proficient).toBe(true);expect(JSON.stringify(c)).toBe(before);
});

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import evidence from '../src/core/automation/invocationEvidence.json';
import atWillEvidence from '../src/core/automation/invocationAtWillEvidence.json';

const frozen=process.env.INVOCATION_FROZEN_DIR;
it.skipIf(!frozen).each(finalAtWillInvocations)('hash-verifies real-source $english and exercises learning/payment/reopen/revocation',({english,spell,spellName,required,level,self,materialWaived})=>{
 const index=JSON.parse(readFileSync(`${frozen}/index.json`,'utf8')),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const read=(path:keyof typeof evidence.inputs)=>{const row=index.rows.find((row:any)=>row.url===`https://5e.kiwee.top/data/${path}`)!;expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${frozen}/${row.path}`,'utf8'));expect(hash(data)).toBe(evidence.inputs[path]);expect(row.sha256).toBe(hash(data));return data;};
 const classes=read('class/class-warlock.json'),optional=read('optionalfeatures.json'),spells=read('spells/spells-phb.json'),raw=optional.optionalfeature.find((row:any)=>row.ENG_name===english&&row.source==='PHB'),spellRaw=spells.spell.find((row:any)=>row.ENG_name===spell&&row.source==='PHB');
 expect(atWillEvidence.frozenRevision).toBe(evidence.frozenRevision);expect(hash(raw)).toBe(atWillEvidence.entryHashes[`${english}|PHB`]);expect(hash(spellRaw)).toBe(atWillEvidence.entryHashes[`${spell}|PHB`]);expect(raw.page).toBe(111);expect(raw.additionalSpells).toEqual([{innate:{_:[spellName]}}]);expect(raw.prerequisite).toEqual(required===15?[{level:{level:15,class:{ENG_name:'Warlock',name:'魔契师'}}}]:undefined);expect(spellRaw.level).toBe(level);expect(spellRaw.range).toEqual({type:'point',distance:self?{type:'self'}:{type:'feet',amount:30}});expect(spellRaw.components.v).toBe(true);expect(spellRaw.components.s).toBe(true);expect(!!spellRaw.components.m).toBe(english!=='Master of Myriad Forms');
 const rule=atWillEvidence.rules.find(row=>row.reference===`${english}|PHB`)!;expect(rule.boundary.includes('不消耗法术位和材料成分')).toBe(materialWaived);
 const entries=normalizeData({...classes,...optional,...spells},'frozen-final-atwill-20261024'),c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(row=>row.english==='Warlock'&&row.source==='PHB')!,level:required,quantity:1,equipped:false}];sync(c,entries);const entry=entries.find(row=>row.english===english&&row.source==='PHB')!;learn(c,entries,entry);const grant=root(c,english),granted=child(c,english);expect(granted.entry.english).toBe(spell);expect(granted.entry.raw.level).toBe(level);
 c.runtime.tempHp=7;c.runtime.resources.manual={max:5,current:1};const resources=structuredClone(c.runtime.resources);for(let i=0;i<2;i++)expect(performSpellAction(c,spellActionRequest(c,granted.id,'free',`real-${i}`))).toMatchObject({status:'applied',receipt:{level}});const saved=roundtrip(c);sync(saved,[]);expect(saved.runtime.resources).toEqual(resources);expect(saved.runtime.tempHp).toBe(7);const request=spellActionRequest(saved,granted.id,'free','before-down');saved.selections[0].level=required-1;expect(spellPayments(saved,granted.id).options).toEqual([]);rejectUnchanged(saved,request);sync(saved,[]);expect(saved.classChoiceArchive?.[grant.id]).toBeDefined();const restored=roundtrip(saved);restored.selections[0].level=required;sync(restored,[]);expect(root(restored,english).id).toBe(grant.id);expect(child(restored,english).id).toBe(granted.id);expect(spellPayments(restored,granted.id).options).toMatchObject([{id:'free',level}]);validateCharacter(restored);
});
