import {describe,expect,it} from 'vitest';
import {dualInvocations,invocationDualPaymentFixture} from './fixtures/invocationDualPaymentFixture';
import {learn} from './fixtures/invocationFixture';
import {invocationRule} from '../src/core/automation/invocations';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';

const child=(c:ReturnType<typeof invocationDualPaymentFixture>['c'])=>c.selections.find(row=>row.grantKey?.startsWith('source-spell:'))!;
describe.each(dualInvocations)('$english atomic invocation payment',({english,spell,level,required})=>{
 it('learns the exact invocation and spends one long-rest use plus its current Warlock pact slot atomically',()=>{
  const {c,entries,find}=invocationDualPaymentFixture(required);
  expect(invocationRule(find(english))).toMatchObject({reference:`${english}|PHB`,spellReference:`${spell}|PHB`,spellLevel:level,payment:'pact-and-use'});
  learn(c,entries,find(english));const row=child(c),key=specialSpellResource(row.id,c),slot=`pact-slot:${Math.min(5,Math.ceil(required/2))}`;
  expect(spellPayments(c,row.id).options).toMatchObject([{id:'invocation-pact',level:Number(slot.at(-1)),debits:[{resourceId:key,cost:1},{resourceId:slot,cost:1}],available:true}]);
  const result=performSpellAction(c,spellActionRequest(c,row.id,'invocation-pact','first'));
  expect(result).toMatchObject({status:'applied',receipt:{spent:[{resourceId:key,before:1,after:0},{resourceId:slot,before:2,after:1}]}});
  expect(c.runtime.resources[key].current).toBe(0);expect(c.runtime.resources[slot].current).toBe(1);
 });
});

import {sync} from './fixtures/invocationFixture';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {sourceSpellRestPlan,sourceSpellRestRequest,sourceSpellRestoreOffer,validateActionState} from '../src/core/automation/actions';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {newCharacter,type Character} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {newAutomationState} from '../src/core/automation/state';
import {syncAutoResources} from '../src/core/resources';
import {setSpecialSpell,changeSpecialSpellUses} from '../src/core/specialSpells';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import dualEvidence from '../src/core/automation/invocationDualEvidence.json';
import evidence from '../src/core/automation/invocationEvidence.json';

const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
function setup(english='Mire the Mind',at=9){const fixture=invocationDualPaymentFixture(at);learn(fixture.c,fixture.entries,fixture.find(english));const row=child(fixture.c),key=specialSpellResource(row.id,fixture.c),slot=`pact-slot:${Math.min(5,Math.ceil(at/2))}`;return {...fixture,row,key,slot,root:fixture.c.selections.find(root=>root.id===row.parentId)!};}
const cast=(c:Character,id:string,action='cast')=>spellActionRequest(c,id,'invocation-pact',action);
const rejectUnchanged=(c:Character,request:ReturnType<typeof cast>)=>{const before=JSON.stringify(c);expect(performSpellAction(c,request).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);};

describe.each(dualInvocations)('$english source and class gates',({english,required})=>{
 it('does not substitute total character level for its own exact Warlock prerequisite',()=>{
  const {c,entries,find,choiceId}=invocationDualPaymentFixture(required-1);const other=structuredClone(c.selections[0]);other.id='other-class';other.entry={...other.entry,id:'fighter',english:'Fighter',raw:{...other.entry.raw,ENG_name:'Fighter',casterProgression:undefined,optionalfeatureProgression:[]}};other.level=20;c.selections.push(other);
  const before=JSON.stringify(c),option=sheetChoices(c,entries).find(choice=>choice.id===choiceId)?.options.find(option=>option.value===find(english).id);expect(option?.grant).toBeUndefined();expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['prerequisite','payload','source','raw-source','edition','copy','extra-mechanics'] as const)('does not recognize changed %s as the reviewed invocation',mode=>{
  const {c,entries,find}=invocationDualPaymentFixture(),entry=find(english);
  if(mode==='prerequisite')entry.raw.prerequisite=[{level:1}];if(mode==='payload')entry.raw.additionalSpells[0].innate._.daily['1e']=['侦测魔法'];if(mode==='source')entry.source='TCE';if(mode==='raw-source')entry.raw.source='TCE';if(mode==='edition')entry.edition='2024';if(mode==='copy')entry.raw._copy={};if(mode==='extra-mechanics')entry.raw.freeSlot=true;
  expect(invocationRule(entry)).toBeUndefined();c.selections.push({id:'manual-invocation',entry,quantity:1,level:1,equipped:false});syncSourceSpells(c,entries);
  for(const row of c.selections.filter(row=>row.parentId==='manual-invocation'))expect(spellPayments(c,row.id).options).toEqual([]);
 });
 it('preserves a manual same-name invocation rather than adopting it or free-casting its daily spell',()=>{
  const {c,entries,find,choiceId}=invocationDualPaymentFixture();c.selections.push({id:'manual-invocation',entry:{...structuredClone(find(english)),id:'manual-import'},quantity:1,level:1,equipped:false});const manual=structuredClone(c.selections.at(-1));expect(()=>setSheetChoiceSlot(c,choiceId,0,find(english).id,entries)).toThrow('手工');sync(c,entries);expect(c.selections.find(row=>row.id==='manual-invocation')).toEqual(manual);for(const row of c.selections.filter(row=>row.parentId==='manual-invocation'))expect(spellPayments(c,row.id).options).toEqual([]);
 });
});

describe('atomic two-resource validation',()=>{
 it.each(['source','pact'] as const)('never writes either pool when %s balance is insufficient or invalid',pool=>{
  for(const mode of ['zero','missing','negative','fraction','over-max','infinite','bad-max','unlimited','manual'] as const){
   const {c,row,key,slot}=setup(),id=pool==='source'?key:slot,r=c.runtime.resources[id];
   if(mode==='zero')r.current=0;if(mode==='missing')delete c.runtime.resources[id];if(mode==='negative')r.current=-1;if(mode==='fraction')r.current=0.5;if(mode==='over-max')r.current=r.max+1;if(mode==='infinite')r.current=Infinity;if(mode==='bad-max')r.max=10;if(mode==='unlimited')r.unlimited=true;if(mode==='manual'){delete r.automatic;delete r.sourceSpellGrant;}
   const before=JSON.stringify(c),offer=spellPayments(c,row.id);expect(offer.options.every(option=>!option.available)).toBe(true);expect(JSON.stringify(c)).toBe(before);rejectUnchanged(c,cast(c,row.id,mode));
  }
 });
 it.each(['free','source','slot:spell-slot:5','slot:pact-slot:5','invocation-pact:other'])('never permits alternative payment %s',payment=>{
  const {c,row}=setup();c.runtime.resources['spell-slot:5']={max:9,current:9};rejectUnchanged(c,spellActionRequest(c,row.id,payment,'wrong-payment'));
 });
 it.each(['stale-level','manual-correct-level','wrong-owner','two-pact-owners','subclass-pact','missing-feature','manual-feature','dismissed-feature','feature-copy','feature-raw-edition','feature-effects','source-raw-identity','source-kind','class-caster','class-identity'] as const)('rejects %s rather than defaulting a pact resource owner',mode=>{
  const {c,row,slot}=setup(),feature=c.selections.find(row=>row.entry.english==='Pact Magic')!;
  if(mode==='stale-level'){delete c.runtime.resources[slot];c.runtime.resources['pact-slot:4']={max:2,current:2,automatic:true};}
  if(mode==='manual-correct-level')delete c.runtime.resources[slot].automatic;
  if(mode==='wrong-owner'){c.selections[0].entry.english='Fighter';c.selections[0].entry.raw.ENG_name='Fighter';}
  if(mode==='two-pact-owners'){const other=structuredClone(c.selections[0]);other.id='other-pact';c.selections.push(other);}
  if(mode==='subclass-pact'){const sub=structuredClone(c.selections[0]);sub.id='pact-sub';sub.parentId='warlock';sub.entry.kind='subclass';sub.entry.raw.className='魔契师';sub.entry.raw.classSource='PHB';c.selections.push(sub);}
  if(mode==='missing-feature')c.selections=c.selections.filter(row=>row.id!==feature.id);
  if(mode==='manual-feature')delete feature.grantKey;if(mode==='dismissed-feature')c.dismissedFeatures=[`warlock|${feature.grantKey}`];if(mode==='feature-copy')feature.entry.raw._copy={};if(mode==='feature-raw-edition')feature.entry.raw.edition='one';if(mode==='feature-effects')feature.entry.effects=[{op:'add',target:'ac',value:1}];if(mode==='source-raw-identity')c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.raw.ENG_name='Other';if(mode==='source-kind')c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.kind='feat';if(mode==='class-caster')c.selections[0].entry.raw.casterProgression='full';if(mode==='class-identity')c.selections[0].entry.raw.ENG_name='Other';
  expect(spellPayments(c,row.id).options.every(option=>!option.available)).toBe(true);rejectUnchanged(c,cast(c,row.id));
 });
 it.each(['answer','parent','grant','child-parent','child-grant','child-level','child-identity','class-level','source-disabled','feature-disabled','owner-disabled','invocation-disabled'] as const)('rechecks %s without trusting cached active metadata for cast or restore',mode=>{
  const {c,row,key,root}=setup(),request=cast(c,row.id);c.runtime.resources[key].current=0;const restore=spellActionRequest(c,row.id,'source','restore','restore');c.runtime.resources[key].current=1;
  if(mode==='answer')c.answers[root.requirementId!]=[];if(mode==='parent')root.parentId='warlock';if(mode==='grant')root.grantKey='choice:fake';if(mode==='child-parent')row.parentId='warlock';if(mode==='child-grant')row.grantKey='source-spell:fake';if(mode==='child-level')row.entry.raw.level=1;if(mode==='child-identity')row.entry.raw.ENG_name='Other';if(mode==='class-level')c.selections[0].level=4;if(mode==='source-disabled')c.profile.enabledSources=[];if(mode==='feature-disabled')c.profile.disabledEntries=[c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.id];if(mode==='owner-disabled')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='invocation-disabled')c.profile.disabledEntries=[root.entry.id];
  const before=JSON.stringify(c);expect(spellPayments(c,row.id).options).toEqual([]);expect(sourceSpellRestoreOffer(c,row.id)).toBeUndefined();expect(JSON.stringify(c)).toBe(before);rejectUnchanged(c,request);c.runtime.resources[key].current=0;rejectUnchanged(c,restore);
 });
 it('uses the current pact level, never the spell base level, across all pact capacities',()=>{
  for(const at of [2,3,5,7,9,11,17,20]){const {c,row,slot}=setup('Thief of Five Fates',at),level=Math.min(5,Math.ceil(at/2)),max=at<11?2:at<17?3:4;expect(spellPayments(c,row.id).options).toMatchObject([{level,debits:[{cost:1},{resourceId:slot,cost:1}]}]);expect(performSpellAction(c,cast(c,row.id))).toMatchObject({status:'applied',receipt:{level,spent:[{before:1,after:0},{before:max,after:max-1}]}});}
 });
 it('rejects stale offers even when a changed class level or balance would still afford payment',()=>{
  const {c,row,slot}=setup('Thief of Five Fates',7),request=cast(c,row.id);c.selections[0].level=9;syncAutoResources(c);rejectUnchanged(c,request);
  const fresh=cast(c,row.id,'balance-before');c.runtime.resources['pact-slot:5'].current=1;rejectUnchanged(c,fresh);expect(c.runtime.resources[slot]).toBeUndefined();
 });
 it('opening menus, cancelling confirmation and reading recovery plans never writes',()=>{
  const {c,row,key}=setup();c.runtime.resources[key].current=0;const before=JSON.stringify(c);
  spellPayments(c,row.id);sourceSpellRestoreOffer(c,row.id);sourceSpellRestPlan(c,'short');sourceSpellRestPlan(c,'long');spellActionRequest(c,row.id,'source','cancelled','restore');expect(JSON.stringify(c)).toBe(before);
 });
 it('checks the entire transaction before changing counters and deduplicates the exact accepted request through reopen',()=>{
  const {c,row,key,slot}=setup(),request=cast(c,row.id),parallel=cast(c,row.id,'parallel');expect(performSpellAction(c,request).status).toBe('applied');const saved=roundtrip(c),before=JSON.stringify(saved);expect(performSpellAction(saved,request).status).toBe('duplicate');expect(JSON.stringify(saved)).toBe(before);rejectUnchanged(saved,parallel);expect(saved.runtime.resources[key].current).toBe(0);expect(saved.runtime.resources[slot].current).toBe(1);
  expect(performSpellAction(saved,spellActionRequest(saved,row.id,'source','restore','restore')).status).toBe('applied');rejectUnchanged(saved,request);expect(performSpellAction(saved,cast(saved,row.id,'new')).status).toBe('applied');expect(saved.runtime.resources[slot].current).toBe(0);
 });
});

describe('invocation recovery and retained lifecycle',()=>{
 it('restores only the selected one-use counter on explicit long-rest confirmation, never slots, HP or another invocation',()=>{
  const {c,entries,find,row,key,slot}=setup();learn(c,entries,find('Sign of Ill Omen'),1);const other=c.selections.find(child=>child.entry.english==='Bestow Curse'&&child.grantKey?.startsWith('source-spell:'))!,otherKey=specialSpellResource(other.id,c);
  performSpellAction(c,cast(c,row.id));performSpellAction(c,cast(c,other.id,'second'));c.runtime.hp=2;c.runtime.tempHp=7;c.runtime.resources.manual={max:9,current:1};const before=structuredClone(c.runtime.resources);
  expect(sourceSpellRestoreOffer(c,row.id)).toEqual({paymentId:'source',label:'确认已长休恢复本祈唤次数',available:true});expect(sourceSpellRestPlan(c,'short').resources).toEqual([]);expect(sourceSpellRestPlan(c,'long').resources.map(row=>row.resourceId).sort()).toEqual([key,otherKey].sort());
  rejectUnchanged(c,sourceSpellRestRequest(c,'short','short'));
  const restore=spellActionRequest(c,row.id,'source','restore','restore');expect(performSpellAction(c,restore)).toMatchObject({status:'applied',receipt:{mode:'restore',resourceId:key,before:0,after:1}});expect(c.runtime.resources).toEqual({...before,[key]:{...before[key],current:1}});expect(c.runtime.hp).toBe(2);expect(c.runtime.tempHp).toBe(7);expect(c.runtime.resources[slot].current).toBe(0);const after=JSON.stringify(c);expect(performSpellAction(c,restore).status).toBe('duplicate');expect(JSON.stringify(c)).toBe(after);
 });
 it('recomputes long-only recovery rather than trusting a forged cached short recovery field',()=>{
  const {c,row,key}=setup();performSpellAction(c,cast(c,row.id));c.spellSettings!.special![row.id].recovery='short';const before=JSON.stringify(c);expect(sourceSpellRestPlan(c,'short').resources).toEqual([]);expect(sourceSpellRestPlan(c,'long').resources).toEqual([]);expect(sourceSpellRestPlan(c,'long').reason).toBeTruthy();expect(JSON.stringify(c)).toBe(before);
 });
 it.each(['downgrade','source','owner','invocation','forget','replace','automation'] as const)('does not refresh a spent use after %s, saving, reopening and restoration',mode=>{
  const {c,entries,find,row,key,slot,root,choiceId}=setup();performSpellAction(c,cast(c,row.id));const ids=[root.id,row.id],spent=structuredClone(c.runtime.resources[key]),pact=structuredClone(c.runtime.resources[slot]);
  if(mode==='downgrade')c.selections[0].level=4;if(mode==='source')c.profile.enabledSources=[];if(mode==='owner')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='invocation')c.profile.disabledEntries=[root.entry.id];if(mode==='forget')setSheetChoiceSlot(c,choiceId,0,undefined,entries);if(mode==='replace')setSheetChoiceSlot(c,choiceId,0,find('Eldritch Sight').id,entries);if(mode==='automation')c.automation!.enabled=false;
  sync(c,entries);const saved=roundtrip(c);saved.selections[0].level=9;saved.profile.enabledSources=['PHB'];saved.profile.disabledEntries=[];saved.automation!.enabled=true;if(mode==='forget'||mode==='replace')setSheetChoiceSlot(saved,choiceId,0,find('Mire the Mind').id,[]);sync(saved,[]);expect(ids.every(id=>saved.selections.some(row=>row.id===id))).toBe(true);expect(saved.runtime.resources[key]).toEqual(spent);expect(saved.runtime.resources[slot]).toEqual(pact);expect(spellPayments(saved,row.id).options[0].available).toBe(false);validateCharacter(saved);
 });
 it('does not refill a lost saved counter or replace a manually edited counter on refresh',()=>{
  const {c,entries,row,key}=setup();performSpellAction(c,cast(c,row.id));delete c.runtime.resources[key];sync(c,entries);expect(c.runtime.resources[key].current).toBe(0);c.runtime.resources[key].max=4;c.runtime.resources[key].current=2;const manual=structuredClone(c.runtime.resources[key]);sync(c,entries);expect(c.runtime.resources[key]).toEqual(manual);rejectUnchanged(c,cast(c,row.id));rejectUnchanged(c,spellActionRequest(c,row.id,'source','restore','restore'));
 });
 it('does not adopt a pre-existing manual resource at the generated key',()=>{
  const {c,entries,row,key}=setup();c.selections=c.selections.filter(selection=>selection.id!==row.id);delete c.spellSettings!.special![row.id];c.runtime.resources[key]={name:'manual collision',max:1,current:1,type:'count'};const manual=structuredClone(c.runtime.resources[key]);syncSourceSpells(c,entries);expect(c.runtime.resources[key]).toEqual(manual);rejectUnchanged(c,cast(c,row.id));
 });
 it('preserves manual same-name spells, balances, notes and unrelated slots through payments and export',()=>{
  const {c,entries,find,row,key,slot}=setup();c.selections.push({id:'manual-slow',entry:structuredClone(find('Slow')),quantity:1,level:1,equipped:false});setSpecialSpell(c,'manual-slow',{mode:'uses',max:4});changeSpecialSpellUses(c,'manual-slow',2);c.runtime.resources.manual={name:'缓慢术',max:9,current:7};c.runtime.resources['spell-slot:5']={max:7,current:6};c.notes='manual adjudication';const resources=structuredClone(c.runtime.resources),manual=structuredClone(c.selections.at(-1)),config=structuredClone(c.spellSettings!.special!['manual-slow']);performSpellAction(c,cast(c,row.id));const saved=roundtrip(c);sync(saved,entries);expect(saved.runtime.resources).toEqual({...resources,[key]:{...resources[key],current:0},[slot]:{...resources[slot],current:resources[slot].current-1}});expect(saved.selections.find(row=>row.id==='manual-slow')).toEqual(manual);expect(saved.spellSettings!.special!['manual-slow']).toEqual(config);expect(saved.notes).toBe('manual adjudication');
 });
 it('retains true two-debit receipts through JSON export and rejects forged recovery-shaped or malformed receipts',()=>{
  const {c,row}=setup();performSpellAction(c,cast(c,row.id));const saved=roundtrip(c);expect(saved.runtime.automationActions).toEqual(c.runtime.automationActions);expect(saved.runtime.automationActions!.last!.recovered).toBeUndefined();expect(saved.runtime.automationActions!.last!.resourceId).toBeUndefined();
  for(const mode of ['one','duplicate','gain','fraction','negative','with-recovery','with-single','restore-mode'] as const){const state=structuredClone(saved.runtime.automationActions!),last=state.last!;
   if(mode==='one')last.spent!.pop();if(mode==='duplicate')last.spent![1].resourceId=last.spent![0].resourceId;if(mode==='gain')last.spent![0].after=2;if(mode==='fraction')last.spent![0].before=1.5;if(mode==='negative')last.spent![0].after=-1;if(mode==='with-recovery')last.recovered=[];if(mode==='with-single')last.resourceId='manual';if(mode==='restore-mode')last.mode='restore';expect(()=>validateActionState(state)).toThrow();
  }
 });
});

const frozen=process.env.INVOCATION_FROZEN_DIR;
it.skipIf(!frozen)('hash-verifies all seven frozen PHB invocations and runs independent real-source dual transactions at each prerequisite',()=>{
 const index=JSON.parse(readFileSync(`${frozen}/index.json`,'utf8')),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const read=(path:keyof typeof evidence.inputs)=>{const row=index.rows.find((row:any)=>row.url===`https://5e.kiwee.top/data/${path}`)!;expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${frozen}/${row.path}`,'utf8'));expect(hash(data)).toBe(evidence.inputs[path]);expect(row.sha256).toBe(hash(data));return data;};
 const classes=read('class/class-warlock.json'),optional=read('optionalfeatures.json'),spells=read('spells/spells-phb.json');
 const pact=classes.classFeature.find((raw:any)=>raw.ENG_name==='Pact Magic'&&raw.source==='PHB');expect(hash(pact)).toBe(dualEvidence.entryHashes['Pact Magic|Warlock|PHB|1']);
 for(const rule of dualEvidence.rules){const raw=optional.optionalfeature.find((raw:any)=>`${raw.ENG_name}|${raw.source}`===rule.reference),spell=spells.spell.find((raw:any)=>`${raw.ENG_name}|${raw.source}`===rule.spellReference);expect(hash(raw)).toBe(dualEvidence.entryHashes[rule.reference as keyof typeof dualEvidence.entryHashes]);expect(hash(spell)).toBe(dualEvidence.entryHashes[rule.spellReference as keyof typeof dualEvidence.entryHashes]);expect(raw.additionalSpells).toEqual([{innate:{_:{daily:{'1e':[rule.spell]}}}}]);expect(raw.prerequisite).toEqual(rule.requiredClassLevel?[{level:{level:rule.requiredClassLevel,class:{ENG_name:'Warlock',name:'魔契师'}}}]:undefined);
  const entries=normalizeData({...classes,...optional,...spells},'frozen-dual-20261024'),c=newCharacter('2014'),at=rule.requiredClassLevel??2;c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(entry=>entry.english==='Warlock'&&entry.source==='PHB')!,level:at,quantity:1,equipped:false}];sync(c,entries);syncAutoResources(c);const entry=entries.find(entry=>`${entry.english}|${entry.source}`===rule.reference)!;learn(c,entries,entry);const row=c.selections.find(row=>row.entry.english===rule.spellReference.split('|')[0]&&row.grantKey?.startsWith('source-spell:'))!;expect(row).toBeDefined();expect(row.entry.raw.level).toBe(rule.spellLevel);expect(performSpellAction(c,cast(c,row.id))).toMatchObject({status:'applied',receipt:{level:Math.min(5,Math.ceil(at/2)),spent:[{before:1,after:0},{before:2,after:1}]}});const saved=roundtrip(c);sync(saved,[]);expect(spellPayments(saved,row.id).options[0].available).toBe(false);expect(sourceSpellRestPlan(saved,'short').resources).toEqual([]);expect(performSpellAction(saved,spellActionRequest(saved,row.id,'source','restore','restore')).status).toBe('applied');expect(saved.runtime.resources[`pact-slot:${Math.min(5,Math.ceil(at/2))}`].current).toBe(1);validateCharacter(saved);
 }
});
it('learns seven independent invocation pools only at sufficient capacity and does not share their long-rest limits',()=>{
 const {c,entries,find,choiceId}=invocationDualPaymentFixture(15);for(const [slot,rule] of dualInvocations.entries())learn(c,entries,find(rule.english),slot);expect(sheetChoices(c,entries).find(choice=>choice.id===choiceId)?.count).toBe(7);const spells=c.selections.filter(row=>row.grantKey?.startsWith('source-spell:'));expect(spells).toHaveLength(7);expect(new Set(spells.map(row=>specialSpellResource(row.id,c))).size).toBe(7);for(const [i,row] of spells.entries()){c.runtime.resources['pact-slot:5'].current=3;expect(performSpellAction(c,cast(c,row.id,`all-${i}`)).status).toBe('applied');}expect(sourceSpellRestPlan(c,'long').resources).toHaveLength(7);expect(sourceSpellRestPlan(c,'short').resources).toHaveLength(0);expect(c.runtime.resources['pact-slot:5'].current).toBe(2);validateCharacter(roundtrip(c));
});

import {removeSelection} from '../src/core/sheet';
describe('review-found invocation identity attacks',()=>{
 it('never falls back to generic free uses when an invocation owner kind is malformed then synchronized',()=>{
  const {c,entries,row,root}=setup('Minions of Chaos');root.entry.kind='feat';const before=JSON.stringify(c);rejectUnchanged(c,cast(c,row.id));expect(JSON.stringify(c)).toBe(before);sync(c,entries);const kept=c.selections.find(child=>child.id===row.id);if(kept){expect(spellPayments(c,kept.id).options).toEqual([]);rejectUnchanged(c,spellActionRequest(c,kept.id,'source','generic-free'));}
 });
 it('rejects cached usage identity tampering before spending, and a genuine spent use survives subsequent removal/relearn',()=>{
  const {c,entries,row,root,key}=setup();c.spellSettings!.special![row.id].sourceGrant!.usageKey='forged';rejectUnchanged(c,cast(c,row.id));sync(c,entries);expect(performSpellAction(c,cast(c,row.id,'genuine')).status).toBe('applied');removeSelection(c,root.id,false);sync(c,entries);expect(c.runtime.resources[specialSpellResource(child(c).id,c)].current).toBe(0);expect(c.runtime.sourceSpellSpent?.forged??0).toBe(0);
 });
 it('preserves one canonical quota across different imported identities, learning slots, archives and explicit restoration',()=>{
  const {c,entries,find,row,key,choiceId}=setup('Minions of Chaos');performSpellAction(c,cast(c,row.id));const canonical=find('Minions of Chaos'),alias={...structuredClone(canonical),id:'imported-alias',packId:'imported'};entries.push(alias);
  setSheetChoiceSlot(c,choiceId,0,undefined,entries);sync(c,entries);const saved=roundtrip(c);learn(saved,entries,alias,1);const alternate=saved.selections.find(row=>row.entry.english==='Conjure Elemental'&&row.grantKey?.startsWith('source-spell:'))!;expect(specialSpellResource(alternate.id,saved)).toBe(key);expect(saved.runtime.resources[key].current).toBe(0);rejectUnchanged(saved,cast(saved,alternate.id,'alias-repeat'));
  expect(performSpellAction(saved,spellActionRequest(saved,alternate.id,'source','long-confirm','restore')).status).toBe('applied');setSheetChoiceSlot(saved,choiceId,1,undefined,entries);sync(saved,entries);learn(saved,entries,canonical,0);expect(specialSpellResource(row.id,saved)).toBe(key);expect(saved.runtime.resources[key].current).toBe(1);expect(performSpellAction(saved,cast(saved,row.id,'canonical-after-rest')).status).toBe('applied');setSheetChoiceSlot(saved,choiceId,0,undefined,entries);sync(saved,entries);learn(saved,entries,alias,1);expect(saved.runtime.resources[key].current).toBe(0);validateCharacter(roundtrip(saved));
 });
 it('never deletes an unowned same-key manual balance when the class or invocation is removed',()=>{
  for(const target of ['warlock','invocation']){const {c,key,root}=setup();c.runtime.resources[key]={name:'manual collision',max:1,current:1};const manual=structuredClone(c.runtime.resources[key]);removeSelection(c,target==='warlock'?'warlock':root.id,false);expect(c.runtime.resources[key]).toEqual(manual);}
 });
});
