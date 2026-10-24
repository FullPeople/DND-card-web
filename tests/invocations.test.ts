import {expect,it,describe} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {invocationFixture,learn,sync} from './fixtures/invocationFixture';
import {invocationRule} from '../src/core/automation/invocations';
import evidence from '../src/core/automation/invocationEvidence.json';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {removeSelection,syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';
const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
const selected=(c:Character,name:string)=>c.selections.find(row=>row.entry.english===name&&row.grantKey?.startsWith('choice:'))!;
const grantedSpell=(c:Character)=>c.selections.find(row=>row.grantKey?.startsWith('source-spell:'))!;
function learned(){const setup=invocationFixture();learn(setup.c,setup.entries,setup.find('Eldritch Sight'));return setup;}

describe('reviewed invocation ownership and source gates',()=>{
 it.each(['class-source','class-edition','class-copy','progression','feature-disabled','feature-dismissed','feature-manual','feature-undeclared'] as const)('does not grant through %s',mode=>{
  const {c,entries,find,choiceId}=invocationFixture();const owner=c.selections[0],feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;
  if(mode==='class-source')owner.entry.source='XPHB';if(mode==='class-edition')owner.entry.edition='2024';if(mode==='class-copy')owner.entry.raw._copy={};if(mode==='progression')owner.entry.raw.optionalfeatureProgression[0].progression=[0,2];if(mode==='feature-disabled')c.profile.disabledEntries=[feature.entry.id];if(mode==='feature-dismissed')c.dismissedFeatures=[`warlock|${feature.grantKey}`];if(mode==='feature-manual')delete feature.grantKey;if(mode==='feature-undeclared')owner.entry.raw.classFeatures=[];
  c.answers[choiceId]=[find('Beguiling Influence').id];c.classChoiceSnapshots={[find('Beguiling Influence').id]:find('Beguiling Influence')};
  // Pure choice planning must not grant on lookalike / stale grants. An explicit
  // later sync may legitimately associate an exact previously manual source.
  expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(row=>row.value===find('Beguiling Influence').id)?.grant).toBeUndefined();expect(selected(c,'Beguiling Influence')).toBeUndefined();
 });
 it.each(['source','edition','copy','prerequisite','spell-payload','effects','feature-type'] as const)('does not reinterpret altered %s as free innate usage',mode=>{
  const {c,entries,find}=invocationFixture();const entry=structuredClone(find('Eldritch Sight'));
  if(mode==='source')entry.source='TCE';if(mode==='edition')entry.edition='2024';if(mode==='copy')entry.raw._copy={};if(mode==='prerequisite')entry.raw.prerequisite=[{level:5}];if(mode==='spell-payload')entry.raw.additionalSpells[0].innate._=['法师护甲'];if(mode==='effects')entry.effects=[{op:'add',target:'ac',value:2}];if(mode==='feature-type')entry.raw.featureType=['EI','AI'];
  expect(invocationRule(entry)).toBeUndefined();c.selections.push({id:'manual',entry,quantity:1,level:1,equipped:false});expect(planSourceSpells(c,entries).grants.every(row=>row.config.sourceGrant?.usage==='check')).toBe(true);
 });
 it.each(['no-class','level-one','no-answer','wrong-parent','wrong-choice'] as const)('cannot gain free invocation casting from %s',mode=>{
  const {c,entries}=learned(),root=selected(c,'Eldritch Sight');if(mode==='no-class')c.selections=c.selections.filter(row=>row.entry.kind!=='class');if(mode==='level-one')c.selections[0].level=1;if(mode==='no-answer')c.answers[root.requirementId!]=[];if(mode==='wrong-parent')root.parentId='warlock';if(mode==='wrong-choice')root.requirementId='warlock:class-optional:1';
  expect(planSourceSpells(c,entries).grants.every(row=>row.config.sourceGrant?.usage==='check')).toBe(true);expect(spellPayments(c,grantedSpell(c).id).options).toEqual([]);
 });
 it.each(['invocation','class','source-feature'] as const)('does not mistake a renamed %s display label for canonical identity',target=>{
  const {c,entries,find,choiceId}=invocationFixture();if(target==='invocation'){const entry=find('Eldritch Sight');entry.name='Eldritch Sight';entry.english='Unrelated';expect(invocationRule(entry)).toBeUndefined();}
  else if(target==='class'){c.selections[0].entry.name='Warlock';c.selections[0].entry.english='Unrelated';}
  else{const source=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;source.entry.english='Unrelated';}
  const invocation=entries.find(row=>row.raw.ENG_name==='Eldritch Sight')!;c.answers[choiceId]=[invocation.id];expect(sheetChoices(c,entries).find(row=>row.id===choiceId)?.options.find(option=>option.value===invocation.id)?.grant).toBeUndefined();
 });
 it('unreviewed invocations and unrelated bare innate arrays remain record-only / check',()=>{
  const {c,entries,find,choiceId}=invocationFixture();const unknown={...structuredClone(find('Eldritch Sight')),id:'unknown',name:'未审查祈唤',english:'Unreviewed Invocation'};unknown.raw.ENG_name=unknown.english;entries.push(unknown);learn(c,entries,unknown);expect(c.answers[choiceId]).toContain(unknown.id);expect(c.selections.some(row=>row.entry.id==='unknown')).toBe(false);
  c.selections.push({id:'unrelated',entry:{...unknown,kind:'feat'},quantity:1,level:1,equipped:false});expect(planSourceSpells(c,entries).grants[0].config.sourceGrant?.usage).toBe('check');
 });
 it('reserves a reviewed identity across different IDs and preserves old duplicate answers',()=>{
  const {c,entries,find,choiceId}=invocationFixture(),entry=find('Eldritch Sight'),duplicate={...structuredClone(entry),id:'another-import'};entries.push(duplicate);learn(c,entries,entry);
  const before=JSON.stringify(c);expect(()=>setSheetChoiceSlot(c,choiceId,1,duplicate.id,entries)).toThrow('同来源');expect(JSON.stringify(c)).toBe(before);
  c.answers[choiceId].push(duplicate.id);c.classChoiceSnapshots![duplicate.id]=duplicate;sync(c,entries);expect(c.answers[choiceId]).toContain(duplicate.id);expect(c.selections.filter(row=>row.entry.english==='Eldritch Sight')).toHaveLength(1);expect(c.selections.filter(row=>row.entry.kind==='spell')).toHaveLength(1);
 });
 it('does not duplicate, mutate or adopt a manually linked same-source invocation',()=>{
  const {c,entries,find,choiceId}=invocationFixture(),entry={...structuredClone(find('Eldritch Sight')),id:'manual-import'};c.selections.push({id:'manual',entry,level:1,quantity:1,equipped:false});const saved=structuredClone(c.selections.at(-1));
  expect(()=>setSheetChoiceSlot(c,choiceId,0,find('Eldritch Sight').id,entries)).toThrow('手工');sync(c,entries);expect(c.selections.find(row=>row.id==='manual')).toEqual(saved);expect(selected(c,'Eldritch Sight')).toBeUndefined();
 });
});

describe('invocation save, replace, suspension and restore lifecycle',()=>{
 it('roundtrips learning and repeated free casting without touching manual state or armor',()=>{
  const {c,entries,find}=learned();learn(c,entries,find('Beguiling Influence'),1);learn(c,entries,find('Armor of Shadows'),2);
  c.proficiencies={deception:true};c.expertise={deception:true};c.notes='manual notes';c.sheetBonuses={ac:3};c.runtime.resources.manual={current:1,max:7};c.runtime.hp=2;c.runtime.resources['pact-slot:3']={current:0,max:2};
  c.selections.push({id:'manual-spell',entry:structuredClone(find('Detect Magic')),quantity:1,level:1,equipped:false});const manual=structuredClone(c.selections.at(-1)),resources=structuredClone(c.runtime.resources);
  const saved=roundtrip(c);for(let i=0;i<4;i++){sync(saved,entries);for(const row of saved.selections.filter(row=>row.grantKey?.startsWith('source-spell:'))){expect(spellPayments(saved,row.id).options.map(x=>x.id)).toEqual(['free']);expect(performSpellAction(saved,spellActionRequest(saved,row.id,'free',`free-${i}-${row.id}`)).status).toBe('applied');}}
  expect(saved.runtime.resources).toEqual(resources);expect(saved.selections.find(row=>row.id==='manual-spell')).toEqual(manual);expect(evaluate(saved).ac).toBe(13);expect(evaluate(saved).skills.deception.expertise).toBe(true);expect(saved.runtime.hp).toBe(2);expect(saved.notes).toBe('manual notes');expect(saved.selections.filter(row=>row.grantKey?.startsWith('choice:'))).toHaveLength(3);validateCharacter(saved);
 });
 it.each(['source','owner-disabled','feature-disabled','entry-disabled','level','forget','replace','toggle'] as const)('parks exact IDs and manual child state through %s, reload and restoration without catalog',mode=>{
  const {c,entries,find,choiceId}=learned(),root=selected(c,'Eldritch Sight'),spell=grantedSpell(c),feature=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;
  c.selections.push({id:'manual-child',entry:structuredClone(find('Mage Armor')),parentId:root.id,quantity:1,level:1,equipped:false});setSpecialSpell(c,'manual-child',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-child',1);const resource=specialSpellResource('manual-child',c),tree=structuredClone(c.selections.filter(row=>row.id===root.id||row.parentId===root.id));
  if(mode==='source')c.profile.enabledSources=[];if(mode==='owner-disabled')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='feature-disabled')c.profile.disabledEntries=[feature.entry.id];if(mode==='entry-disabled')c.profile.disabledEntries=[root.entry.id];if(mode==='level')c.selections[0].level=1;if(mode==='forget')setSheetChoiceSlot(c,choiceId,0,undefined,entries);if(mode==='replace')setSheetChoiceSlot(c,choiceId,0,find('Beguiling Influence').id,entries);if(mode==='toggle')chooseSheetOption(c,choiceId,find('Eldritch Sight').id,entries);
  sync(c,entries);expect(c.classChoiceArchive?.[root.id].selections).toEqual(tree);expect(c.selections.some(row=>row.id===root.id)).toBe(false);expect(spellPayments(c,spell.id).options).toEqual([]);
  const next=roundtrip(c);next.profile.enabledSources=['PHB'];next.profile.disabledEntries=[];next.selections[0].level=5;if(['forget','replace','toggle'].includes(mode))setSheetChoiceSlot(next,choiceId,0,find('Eldritch Sight').id,[]);sync(next,[]);expect(JSON.parse(JSON.stringify(next.selections.filter(row=>tree.some(old=>old.id===row.id))))).toEqual(JSON.parse(JSON.stringify(tree)));expect(next.runtime.resources[resource].current).toBe(1);expect(spellPayments(next,spell.id).options[0]?.id).toBe('free');validateCharacter(next);
 });
 it('explicit feature or class deletion revokes only owned grants and preserves independent spells/skills',()=>{
  for(const target of ['feature','class']){const {c,entries,find}=learned();learn(c,entries,find('Beguiling Influence'),1);c.proficiencies={persuasion:true};c.selections.push({id:'independent',entry:find('Detect Magic'),quantity:1,level:1,equipped:false});const root=selected(c,'Eldritch Sight');removeSelection(c,target==='class'?'warlock':c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.id);sync(c,entries);expect(c.selections.some(row=>row.id===root.id)).toBe(false);expect(c.selections.some(row=>row.id==='independent')).toBe(true);expect(evaluate(c).skills.persuasion.proficient).toBe(true);expect(evaluate(c).skills.deception.proficient).toBe(false);validateCharacter(c);}
 });
 it('discarding an archived class removes orphan special settings while leaving manual data',()=>{
  const {c,entries,choiceId}=learned(),spell=grantedSpell(c);setSheetChoiceSlot(c,choiceId,0,undefined,entries);sync(c,entries);removeSelection(c,'warlock');expect(c.classChoiceArchive).toBeUndefined();expect(c.spellSettings!.special![spell.id]).toBeUndefined();validateCharacter(c);
 });
 it('automation disabled and read-only planning never create or modify a grant',()=>{
  const {c,entries,find,choiceId}=invocationFixture();c.answers[choiceId]=[find('Beguiling Influence').id];const before=JSON.stringify(c);sheetChoices(c,entries);evaluate(c);planSourceSpells(c,entries);expect(JSON.stringify(c)).toBe(before);c.automation!.enabled=false;sync(c,entries);expect(evaluate(c).skills.deception.proficient).toBe(false);expect(selected(c,'Beguiling Influence')).toBeUndefined();
 });
 it('old record-only answers acquire one grant at explicit sync, without rewriting user answers',()=>{
  const {c,entries,find,choiceId}=invocationFixture();c.answers[choiceId]=[find('Beguiling Influence').id];c.classChoiceSnapshots={[find('Beguiling Influence').id]:structuredClone(find('Beguiling Influence'))};const answers=JSON.stringify(c.answers);const saved=roundtrip(c);for(let i=0;i<4;i++)sync(saved,entries);expect(saved.selections.filter(row=>row.entry.english==='Beguiling Influence')).toHaveLength(1);expect(JSON.stringify(saved.answers)).toBe(answers);
 });
 it('level 5 to 4 parks only the third invocation and restores its old IDs at level 5',()=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find('Beguiling Influence'),0);learn(c,entries,find('Eldritch Sight'),1);learn(c,entries,find('Armor of Shadows'),2);const armor=selected(c,'Armor of Shadows'),sight=selected(c,'Eldritch Sight');c.selections[0].level=4;sync(c,entries);expect(c.classChoiceArchive?.[armor.id]).toBeDefined();expect(c.selections.find(row=>row.id===sight.id)).toBeDefined();expect(evaluate(c).skills.deception.proficient).toBe(true);const saved=roundtrip(c);saved.selections[0].level=5;sync(saved,[]);expect(selected(saved,'Armor of Shadows').id).toBe(armor.id);expect(saved.selections.filter(row=>row.grantKey?.startsWith('source-spell:'))).toHaveLength(2);
 });
 it('saved invocation snapshots win over later same-ID catalog changes',()=>{
  const {c,entries,find}=learned();const original=selected(c,'Eldritch Sight').entry;find('Eldritch Sight').raw.additionalSpells=[{innate:{_:['法师护甲']}}];sync(c,entries);expect(selected(c,'Eldritch Sight').entry).toEqual(original);expect(grantedSpell(c).entry.english).toBe('Detect Magic');
 });
 it('disablement after repeated sync immediately blocks skill effects and payments through the source parent',()=>{
  const {c,entries,find}=learned();learn(c,entries,find('Beguiling Influence'),1);for(let i=0;i<3;i++)sync(c,entries);c.profile.disabledEntries=[c.selections.find(row=>row.entry.english==='Eldritch Invocations')!.entry.id];expect(evaluate(c).skills.deception.proficient).toBe(false);expect(spellPayments(c,grantedSpell(c).id).options).toEqual([]);
 });
 it.each(['level','declaration'] as const)('parks invocation children before %s removal while automation is disabled',mode=>{
  const {c,entries,find}=learned(),root=selected(c,'Eldritch Sight');c.selections.push({id:'manual-child',entry:structuredClone(find('Mage Armor')),parentId:root.id,quantity:1,level:1,equipped:false});setSpecialSpell(c,'manual-child',{mode:'uses',max:3});changeSpecialSpellUses(c,'manual-child',1);const resource=specialSpellResource('manual-child',c),refs=structuredClone(c.selections[0].entry.raw.classFeatures);
  c.automation!.enabled=false;if(mode==='level')c.selections[0].level=1;else c.selections[0].entry.raw.classFeatures=[];sync(c,entries);expect(c.classChoiceArchive?.[root.id].selections.some(row=>row.id==='manual-child')).toBe(true);expect(c.runtime.resources[resource].current).toBe(1);const saved=roundtrip(c);saved.automation!.enabled=true;saved.selections[0].level=5;saved.selections[0].entry.raw.classFeatures=refs;sync(saved,[]);expect(saved.selections.some(row=>row.id==='manual-child')).toBe(true);expect(saved.runtime.resources[resource].current).toBe(1);
 });
 it.each([false,true])('an orphaned manual same-source invocation does not block a valid learning grant (same ID %s)',sameId=>{
  const {c,entries,find}=invocationFixture();c.selections.push({id:'manual-orphan',entry:{...structuredClone(find('Eldritch Sight')),id:sameId?find('Eldritch Sight').id:'manual-orphan-entry'},parentId:'missing-parent',quantity:1,level:1,equipped:false});learn(c,entries,find('Eldritch Sight'));expect(selected(c,'Eldritch Sight')).toBeDefined();expect(c.selections.some(row=>row.id==='manual-orphan')).toBe(true);
 });
 it('parks a retained skill grant with mismatched source ancestry instead of keeping it active',()=>{
  const {c,entries,find}=invocationFixture();learn(c,entries,find('Beguiling Influence'));const root=selected(c,'Beguiling Influence');root.parentId='warlock';sync(c,entries);expect(c.selections.some(row=>row.id===root.id)).toBe(false);expect(c.classChoiceArchive?.[root.id].selections[0].parentId).toBe('warlock');expect(evaluate(c).skills.deception.proficient).toBe(false);expect(sheetChoices(c,entries).find(row=>row.id===root.requirementId)?.hint).toContain('原授予与子项记录已保留');validateCharacter(c);
 });
 it('still rejects arbitrary feature archives and malformed invocation archive ancestry',()=>{
  const {c,entries,choiceId}=learned();setSheetChoiceSlot(c,choiceId,0,undefined,entries);sync(c,entries);const root=Object.values(c.classChoiceArchive!)[0].selections[0];root.entry.raw.featureType=['AI'];expect(()=>validateCharacter(c)).toThrow('职业选择保留身份无效');
 });
});

const frozen=process.env.INVOCATION_FROZEN_DIR;
const frozenGroups=[
 {name:'original PHB invocations',references:['Beguiling Influence|PHB','Eldritch Sight|PHB','Armor of Shadows|PHB'],spells:2,skills:true},
 {name:'additional PHB at-will invocations',references:['Beast Speech|PHB','Mask of Many Faces|PHB','Misty Visions|PHB'],spells:3,skills:false},
];
it.skipIf(!frozen).each(frozenGroups)('replays exact frozen $name with source hashes and free spell lifecycle',({references,spells:spellCount,skills})=>{
 expect(frozenGroups.flatMap(group=>group.references).sort()).toEqual(evidence.rules.map(rule=>rule.reference).sort());
 const index=JSON.parse(readFileSync(`${frozen}/index.json`,'utf8')),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const read=(path:string)=>{const row=index.rows.find((row:any)=>row.url===`https://5e.kiwee.top/data/${path}`)!;expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${frozen}/${row.path}`,'utf8'));expect(hash(data)).toBe(evidence.inputs[path as keyof typeof evidence.inputs]);expect(row.sha256).toBe(hash(data));return data;};
 const classes=read('class/class-warlock.json'),optional=read('optionalfeatures.json'),spells=read('spells/spells-phb.json');
 const owner=classes.class.find((r:any)=>r.ENG_name==='Warlock'&&r.source==='PHB'),feature=classes.classFeature.find((r:any)=>r.ENG_name==='Eldritch Invocations'&&r.source==='PHB');expect(hash(owner)).toBe(evidence.entryHashes['Warlock|PHB']);expect(hash(feature)).toBe(evidence.entryHashes['Eldritch Invocations|Warlock|PHB|2']);
 for(const rule of evidence.rules){const raw=optional.optionalfeature.find((r:any)=>`${r.ENG_name}|${r.source}`===rule.reference);expect(hash(raw)).toBe(evidence.entryHashes[rule.reference as keyof typeof evidence.entryHashes]);expect(raw.page).toBe(rule.page);expect(raw.prerequisite).toBeUndefined();}
 const entries=normalizeData({...classes,...optional,...spells},'frozen-20261022'),c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(e=>e.english==='Warlock'&&e.source==='PHB')!,quantity:1,level:5,equipped:false}];sync(c,entries);
 // Each level-5 character legally learns three invocations. Keep the original
 // group intact rather than silently accepting six answers beyond its capacity.
 expect(sheetChoices(c,entries).find(row=>row.id==='warlock:class-optional:0')?.count).toBe(3);
 for(const [slot,reference] of references.entries()){const entry=entries.find(e=>`${e.english}|${e.source}`===reference)!;expect(invocationRule(entry)).toBeDefined();learn(c,entries,entry,slot);}
 expect(c.selections.filter(row=>row.grantKey?.startsWith('choice:')&&row.entry.raw.featureType?.includes('EI'))).toHaveLength(3);
 expect(evaluate(c).skills.deception.proficient).toBe(skills);expect(evaluate(c).skills.persuasion.proficient).toBe(skills);expect(c.selections.filter(row=>row.grantKey?.startsWith('source-spell:'))).toHaveLength(spellCount);
 c.runtime.resources.manual={current:1,max:7};c.runtime.resources['pact-slot:3']={current:0,max:2};const resources=structuredClone(c.runtime.resources);
 const saved=roundtrip(c);sync(saved,[]);for(let attempt=0;attempt<2;attempt++)for(const [index,row] of saved.selections.filter(row=>row.grantKey?.startsWith('source-spell:')).entries()){expect(spellPayments(saved,row.id).options.map(row=>row.id)).toEqual(['free']);expect(performSpellAction(saved,spellActionRequest(saved,row.id,'free',`frozen-${attempt}-${index}`)).status).toBe('applied');}expect(evaluate(saved).ac).toBe(10);expect(saved.runtime.resources).toEqual(resources);validateCharacter(saved);
 const ids=saved.selections.map(row=>row.id);saved.profile.enabledSources=[];sync(saved,[]);expect(evaluate(saved).skills.deception.proficient).toBe(false);const restored=roundtrip(saved);restored.profile.enabledSources=['PHB'];sync(restored,[]);expect(restored.selections.map(row=>row.id).sort()).toEqual(ids.sort());
});
