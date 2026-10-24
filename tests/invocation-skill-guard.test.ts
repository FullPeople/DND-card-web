import {describe,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter,validateCharacter} from '../src/core/validation';
import {type Character,type Entry,type Selection} from '../src/core/model';
import {invocationRule} from '../src/core/automation/invocations';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {invocationFixture,learn,sync} from './fixtures/invocationFixture';

const roundtrip=(c:Character)=>readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character;
function learned(){
 const fixture=invocationFixture();
 learn(fixture.c,fixture.entries,fixture.find('Beguiling Influence'));
 return {...fixture,owner:fixture.c.selections[0],source:fixture.c.selections.find(row=>row.entry.english==='Eldritch Invocations')!,grant:fixture.c.selections.find(row=>row.entry.english==='Beguiling Influence')!};
}
type Setup=ReturnType<typeof learned>;
const pure=(c:Character)=>{const before=JSON.stringify(c),result=evaluate(c);expect(JSON.stringify(c)).toBe(before);return result;};
const rejected=(s:Setup)=>{
 s.c.proficiencies={persuasion:true};s.c.expertise={history:true};
 const result=pure(s.c);
 expect(result.skills.deception.proficient).toBe(false);
 expect(result.skills.persuasion).toMatchObject({proficient:true,expertise:false,sources:['手动记录']});
 expect(result.skills.history).toMatchObject({proficient:true,expertise:true});
};
const proficient=(c:Character)=>{const result=pure(c);for(const key of ['deception','persuasion'])expect(result.skills[key]).toMatchObject({proficient:true,expertise:false});};

it('revokes learned skills immediately when only the source raw identity changes, preserving manual training',()=>{
 const s=learned(),displayName=s.source.entry.name;
 proficient(s.c);
 s.source.entry.raw.ENG_name='Other';
 expect(s.source.entry.name).toBe(displayName);
 rejected(s);
});

const sourceMutations:Record<string,(s:Setup)=>void>={
 english:s=>{s.source.entry.english='Other';},
 'raw-english':s=>{s.source.entry.raw.ENG_name='Other';},
 source:s=>{s.source.entry.source='XPHB';},
 'raw-source':s=>{s.source.entry.raw.source='XPHB';},
 edition:s=>{s.source.entry.edition='2024';},
 'raw-edition':s=>{s.source.entry.raw.edition='one';},
 copy:s=>{s.source.entry.raw._copy={};},
 unresolved:s=>{s.source.entry.raw._unresolvedParent=true;},
 kind:s=>{s.source.entry.kind='feat';},
 category:s=>{s.source.entry.raw._category='feat';},
 level:s=>{s.source.entry.raw.level=1;},
 parent:s=>{s.source.parentId='missing';},
 'grant-key':s=>{s.source.grantKey='ref:forged';},
 'no-grant-key':s=>{delete s.source.grantKey;},
 dismissed:s=>{s.c.dismissedFeatures=[`${s.owner.id}|${s.source.grantKey}`];},
 'raw-skills':s=>{s.source.entry.raw.skillProficiencies=[{deception:true,persuasion:true}];},
 effects:s=>{s.source.entry.effects=[{op:'proficiency',skill:'deception'}];},
 'raw-effects':s=>{s.source.entry.raw.effects=[{op:'proficiency',skill:'deception'}];},
 choices:s=>{s.source.entry.choices=[{id:'spoof',label:'spoof',count:1,options:['deception']}];s.c.answers[`${s.source.id}:custom:spoof`]=['deception'];},
 'raw-choices':s=>{s.source.entry.raw.choices=[{id:'spoof',count:1,options:['deception']}];},
 duplicate:s=>{s.c.selections.push({...structuredClone(s.source),id:'duplicate-source'});},
 removed:s=>{s.c.selections=s.c.selections.filter(row=>row.id!==s.source.id);},
};
describe('current source authorization before synchronization',()=>{
 it.each(Object.keys(sourceMutations))('rejects source %s without regranting through the parent',mode=>{const s=learned();sourceMutations[mode](s);rejected(s);});
});

const ownerMutations:Record<string,(s:Setup)=>void>={
 english:s=>{s.owner.entry.english='Fighter';},
 'raw-english':s=>{s.owner.entry.raw.ENG_name='Fighter';},
 source:s=>{s.owner.entry.source='XPHB';},
 'raw-source':s=>{s.owner.entry.raw.source='XPHB';},
 edition:s=>{s.owner.entry.edition='2024';},
 'raw-edition':s=>{s.owner.entry.raw.edition='one';},
 copy:s=>{s.owner.entry.raw._copy={};},
 unresolved:s=>{s.owner.entry.raw._unresolvedParent=true;},
 kind:s=>{s.owner.entry.kind='feat';},
 'level-one':s=>{s.owner.level=1;},
 'level-too-high':s=>{s.owner.level=21;},
 'level-fraction':s=>{s.owner.level=2.5;},
 progression:s=>{s.owner.entry.raw.optionalfeatureProgression[0].progression=[0,2];},
 'feature-type':s=>{s.owner.entry.raw.optionalfeatureProgression[0].featureType=['AI'];},
 declaration:s=>{s.owner.entry.raw.classFeatures=[];},
 removed:s=>{s.c.selections=s.c.selections.filter(row=>row.id!==s.owner.id);},
};
describe('current owner authorization before synchronization',()=>{
 it.each(Object.keys(ownerMutations))('rejects owner %s without borrowing another class level',mode=>{
  const s=learned(),other=structuredClone(s.owner);other.id='other-class';other.level=20;other.entry.id='fighter';other.entry.english='Fighter';other.entry.raw.ENG_name='Fighter';s.c.selections.push(other);
  ownerMutations[mode](s);rejected(s);
 });
});

const grantMutations:Record<string,(s:Setup)=>void>={
 english:s=>{s.grant.entry.english='Other';},
 'raw-english':s=>{s.grant.entry.raw.ENG_name='Other';},
 'both-identities':s=>{s.grant.entry.english='Other';s.grant.entry.raw.ENG_name='Other';},
 source:s=>{s.grant.entry.source='XPHB';},
 'raw-source':s=>{s.grant.entry.raw.source='XPHB';},
 'both-sources':s=>{s.grant.entry.source='OTHER';s.grant.entry.raw.source='OTHER';s.c.profile.enabledSources.push('OTHER');},
 edition:s=>{s.grant.entry.edition='2024';},
 'raw-edition':s=>{s.grant.entry.raw.edition='one';},
 copy:s=>{s.grant.entry.raw._copy={};},
 unresolved:s=>{s.grant.entry.raw._unresolvedParent=true;},
 kind:s=>{s.grant.entry.kind='feat';},
 category:s=>{s.grant.entry.raw._category='feat';},
 'feature-type':s=>{s.grant.entry.raw.featureType=['AI'];},
 'all-current-markers':s=>{s.grant.entry.kind='feat';s.grant.entry.english='Other';s.grant.entry.raw.ENG_name='Other';s.grant.entry.raw._category='feat';s.grant.entry.raw.featureType=['AI'];},
 'extra-skill':s=>{s.grant.entry.raw.skillProficiencies[0].arcana=true;},
 'missing-skill':s=>{delete s.grant.entry.raw.skillProficiencies[0].persuasion;},
 'absent-skills':s=>{delete s.grant.entry.raw.skillProficiencies;},
 prerequisite:s=>{s.grant.entry.raw.prerequisite=[{level:2}];},
 'extra-mechanic':s=>{s.grant.entry.raw.additionalSpells=[];},
 effects:s=>{s.grant.entry.effects=[{op:'proficiency',skill:'deception'},{op:'add',target:'cha',value:8}];},
 'raw-effects':s=>{s.grant.entry.raw.effects=[{op:'proficiency',skill:'deception'}];},
 choices:s=>{s.grant.entry.choices=[{id:'spoof',label:'spoof',count:1,options:['deception']}];},
 'raw-choices':s=>{s.grant.entry.raw.choices=[{id:'spoof',count:1,options:['deception']}];},
 parent:s=>{s.grant.parentId=s.owner.id;},
 'grant-key':s=>{s.grant.grantKey='choice:forged';},
 'no-grant-key':s=>{delete s.grant.grantKey;},
 requirement:s=>{s.grant.requirementId='warlock:class-optional:1';},
 'no-requirement':s=>{delete s.grant.requirementId;},
 'entry-id':s=>{s.grant.entry.id='forged';},
 snapshot:s=>{s.c.classChoiceSnapshots![s.grant.entry.id].raw.ENG_name='Other';},
};
describe('retained reviewed invocation declarations',()=>{
 it.each(Object.keys(grantMutations))('rejects altered %s without skill, choice or effect fallback',mode=>{
  const s=learned();grantMutations[mode](s);
  s.c.answers[`${s.grant.id}:skills:0`]=['deception','arcana'];s.c.answers[`${s.grant.id}:custom:spoof`]=['deception','arcana'];
  rejected(s);expect(pure(s.c).skills.arcana.proficient).toBe(false);expect(pure(s.c).abilities.cha).toBe(s.c.abilities.cha);
 });
});

it.each(['source','owner','feature','invocation','automation','protocol','answer','removed'] as const)('immediately revokes %s before sync and keeps the entire input unchanged',mode=>{
 const s=learned();
 if(mode==='source')s.c.profile.enabledSources=[];
 if(mode==='owner')s.c.profile.disabledEntries=[s.owner.entry.id];
 if(mode==='feature')s.c.profile.disabledEntries=[s.source.entry.id];
 if(mode==='invocation')s.c.profile.disabledEntries=[s.grant.entry.id];
 if(mode==='automation')s.c.automation!.enabled=false;
 if(mode==='protocol')s.c.automation!.protocol=999;
 if(mode==='answer')s.c.answers[s.choiceId]=[];
 if(mode==='removed')s.c.selections=s.c.selections.filter(row=>row.id!==s.grant.id);
 rejected(s);
});

it('honors the current learned quota before sync and restores a retained third slot',()=>{
 const s=invocationFixture();learn(s.c,s.entries,s.find('Eldritch Sight'),0);learn(s.c,s.entries,s.find('Armor of Shadows'),1);learn(s.c,s.entries,s.find('Beguiling Influence'),2);
 const grant=s.c.selections.find(row=>row.entry.english==='Beguiling Influence')!,answers=structuredClone(s.c.answers);
 proficient(s.c);s.c.selections[0].level=4;expect(pure(s.c).skills.deception.proficient).toBe(false);expect(s.c.answers).toEqual(answers);
 sync(s.c,s.entries);expect(s.c.classChoiceArchive?.[grant.id].selections[0]).toEqual(grant);
 const saved=roundtrip(s.c);saved.selections[0].level=5;sync(saved,[]);proficient(saved);expect(saved.selections.find(row=>row.id===grant.id)).toEqual(grant);
});

it.each(['skills','custom'] as const)('does not let retained %s answers add any skill to a valid invocation or its source',channel=>{
 const s=learned();for(const row of [s.grant,s.source])s.c.answers[`${row.id}:${channel}:spoof`]=['arcana','deception'];
 const result=pure(s.c);expect(result.skills.arcana.proficient).toBe(false);expect(result.skills.deception.sources).toEqual([`${s.grant.entry.name} · PHB`]);proficient(s.c);
});

it('applies one reviewed proficiency, never expertise, through duplicate retained records and aliases',()=>{
 const s=learned(),alias=structuredClone(s.grant);alias.id='duplicate-grant';alias.entry.id='alias';alias.grantKey=`choice:${s.choiceId}:alias`;
 s.c.classChoiceSnapshots!.alias=structuredClone(alias.entry);s.c.answers[s.choiceId].push('alias');s.c.selections.push(alias,{...structuredClone(s.grant),id:'duplicate-same-entry'});
 const result=pure(s.c);for(const skill of ['deception','persuasion'])expect(result.skills[skill]).toMatchObject({proficient:true,expertise:false,value:3,sources:[`${s.grant.entry.name} · PHB`]});
});

it('keeps reviewed manual imports record-only, without adopting them or losing explicit training',()=>{
 const {c,entries,find,choiceId}=invocationFixture(),entry=structuredClone(find('Beguiling Influence'));
 const manual:Selection={id:'manual-invocation',entry,level:1,quantity:1,equipped:false};c.selections.push(manual);c.proficiencies={deception:true};c.expertise={deception:true};
 const original=structuredClone(manual),result=pure(c);
 expect(result.skills.persuasion.proficient).toBe(false);expect(result.skills.deception).toMatchObject({proficient:true,expertise:true,value:6});
 expect(result.issues.find(row=>row.id==='invocation-skills:manual-invocation')?.message).toContain('不自动授予技能熟练');
 expect(()=>setSheetChoiceSlot(c,choiceId,0,entry.id,entries)).toThrow('已经在角色卡中');sync(c,entries);expect(c.selections.find(row=>row.id===manual.id)).toEqual(original);
 const saved=roundtrip(c);expect(pure(saved).skills.persuasion.proficient).toBe(false);expect(saved.proficiencies).toEqual(c.proficiencies);expect(saved.expertise).toEqual(c.expertise);
});

it.each([false,true])('preserves unrelated manual custom features, even with EI metadata (%s), despite a reviewed display label',optional=>{
 const {c,find}=invocationFixture();
 const custom:Entry={...structuredClone(find('Beguiling Influence')),id:'custom',name:'Beguiling Influence',english:'Original custom feature',raw:{name:'Original custom feature',ENG_name:'Original custom feature',source:'PHB',skillProficiencies:[{arcana:true}]},effects:[{op:'proficiency',skill:'deception'},{op:'add',target:'cha',value:2}]};
 if(optional){custom.raw._category='optionalfeature';custom.raw.featureType=['EI'];}
 c.selections.push({id:'custom',entry:custom,level:1,quantity:1,equipped:false});c.answers['custom:skills:0']=['history'];c.answers['custom:custom:extra']=['persuasion'];
 const result=pure(c);for(const skill of ['arcana','deception','history','persuasion'])expect(result.skills[skill].proficient).toBe(true);expect(result.abilities.cha).toBe(12);
 expect(result.issues.some(row=>row.id==='invocation-skills:custom')).toBe(false);
});

it.each(['source','owner','feature','invocation','downgrade','forget','replace','automation'] as const)('parks, exports, reopens and restores %s without rewriting manual skills, notes or spent resources',mode=>{
 const s=learned();s.c.proficiencies={deception:false,history:true};s.c.expertise={history:true};s.c.skillBonuses={deception:2,persuasion:1};s.c.notes='Manual notes';s.c.runtime.resources.manual={current:1,max:7};
 const original=structuredClone(s.grant),manual={proficiencies:structuredClone(s.c.proficiencies),expertise:structuredClone(s.c.expertise),bonuses:structuredClone(s.c.skillBonuses),resources:structuredClone(s.c.runtime.resources)};
 if(mode==='source')s.c.profile.enabledSources=[];
 if(mode==='owner')s.c.profile.disabledEntries=[s.owner.entry.id];
 if(mode==='feature')s.c.profile.disabledEntries=[s.source.entry.id];
 if(mode==='invocation')s.c.profile.disabledEntries=[s.grant.entry.id];
 if(mode==='downgrade')s.owner.level=1;
 if(mode==='forget')setSheetChoiceSlot(s.c,s.choiceId,0,undefined,s.entries);
 if(mode==='replace')setSheetChoiceSlot(s.c,s.choiceId,0,s.find('Eldritch Sight').id,s.entries);
 if(mode==='automation')s.c.automation!.enabled=false;
 expect(pure(s.c).skills.deception).toMatchObject({proficient:false,value:2});
 sync(s.c,s.entries);expect(s.c.classChoiceArchive?.[s.grant.id].selections[0]).toEqual(original);
 const saved=roundtrip(s.c);expect(pure(saved).skills.deception.proficient).toBe(false);
 saved.profile.enabledSources=['PHB'];saved.profile.disabledEntries=[];saved.selections.find(row=>row.id===s.owner.id)!.level=5;saved.automation!.enabled=true;
 if(mode==='forget'||mode==='replace')setSheetChoiceSlot(saved,s.choiceId,0,s.find('Beguiling Influence').id,[]);
 for(let count=0;count<3;count++){sync(saved,[]);proficient(saved);}
 expect(saved.selections.find(row=>row.id===original.id)).toEqual(original);expect(saved.proficiencies).toEqual(manual.proficiencies);expect(saved.expertise).toEqual(manual.expertise);expect(saved.skillBonuses).toEqual(manual.bonuses);expect(saved.runtime.resources).toEqual(manual.resources);expect(saved.notes).toBe('Manual notes');validateCharacter(saved);
});

it('does not award skills from saved answers, choice snapshots or archived entries alone',()=>{
 const s=learned();s.c.selections=s.c.selections.filter(row=>row.id!==s.grant.id);const original=structuredClone(s.c);
 expect(invocationRule(s.c.classChoiceSnapshots![s.grant.entry.id])?.mechanism).toBe('skills');expect(pure(s.c).skills.deception.proficient).toBe(false);sheetChoices(s.c,[]);expect(s.c).toEqual(original);
 sync(s.c,[]);proficient(s.c);
});

it('rechecks a later manual same-source conflict before sync and resumes only the original learned grant',()=>{
 const s=learned(),manual:Selection={id:'later-manual',entry:{...structuredClone(s.grant.entry),id:'manual-import'},level:1,quantity:1,equipped:false};
 s.c.selections.push(manual);
 expect(sheetChoices(s.c,s.entries).find(row=>row.id===s.choiceId)?.options.find(option=>option.value===s.grant.entry.id)?.unavailable).toContain('手工');
 expect(pure(s.c).skills.deception.proficient).toBe(false);
 expect(pure(s.c).skills.persuasion.proficient).toBe(false);
 const original=structuredClone(manual);sync(s.c,s.entries);expect(s.c.selections.find(row=>row.id===manual.id)).toEqual(original);
 s.c.selections=s.c.selections.filter(row=>row.id!==manual.id);sync(s.c,[]);proficient(s.c);expect(s.c.selections.find(row=>row.id===s.grant.id)).toEqual(s.grant);
});

it.each([false,true])('blocks both renamed source identities through the declared PHB parent/ref without a saved source snapshot (learned %s)',hasLearned=>{
 const fixture=hasLearned?learned():invocationFixture(),c=fixture.c,source=c.selections.find(row=>row.entry.english==='Eldritch Invocations')!;
 if(c.classChoiceSnapshots)delete c.classChoiceSnapshots[source.entry.id];
 source.entry.english='Other';source.entry.raw.ENG_name='Other';source.entry.raw.skillProficiencies=[{deception:true}];source.entry.effects=[{op:'proficiency',skill:'persuasion'}];c.answers[`${source.id}:skills:0`]=['arcana'];
 expect(pure(c).skills.deception.proficient).toBe(false);expect(pure(c).skills.persuasion.proficient).toBe(false);expect(pure(c).skills.arcana.proficient).toBe(false);
});

it.each(['owner','source'] as const)('revokes a retained skill grant with cyclic %s ancestry before sync',target=>{
 const s=learned();s.owner.parentId=target==='owner'?s.owner.id:s.source.id;validateCharacter(s.c);rejected(s);
});

it('keeps source ref provenance as a deny boundary when both source identities and the progression are edited',()=>{
 const s=learned();delete s.c.classChoiceSnapshots![s.source.entry.id];s.source.entry.english='Other';s.source.entry.raw.ENG_name='Other';s.source.entry.raw.skillProficiencies=[{deception:true}];s.owner.entry.raw.optionalfeatureProgression[0].progression=[0,2];rejected(s);
});

it('retains automatic child scope through a renamed declared source even without saved snapshots',()=>{
 const s=learned();delete s.c.classChoiceSnapshots;s.source.entry.english='Other';s.source.entry.raw.ENG_name='Other';s.grant.entry.english='Other';s.grant.entry.raw.ENG_name='Other';s.grant.entry.raw._category='feat';s.grant.entry.raw.featureType=['AI'];s.grant.entry.kind='feat';rejected(s);
});

it('preserves saved 2014 source skill effects when only the card edition changes',()=>{
 const s=learned();s.c.edition='2024';s.c.profile.optional.legacy=false;proficient(s.c);
});
