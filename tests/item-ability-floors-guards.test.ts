import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {ABILITIES,type Entry} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {projectItemAbilityFloors,itemAbilityFloorRule} from '../src/core/automation/itemAbilityFloors';
import {baseAbilityScores} from '../src/core/automation/baseAbilities';
import {activeEffectSelections} from '../src/core/automation/active';
import {sourceChoicePrerequisite} from '../src/core/automation/sourceClassChoices';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {setAsiAllocation,asiAllocationStatus} from '../src/core/automation/asi';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {spellValues} from '../src/core/characterDetails';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {weaponAttacks} from '../src/core/weaponAttacks';
import {planFeatureResources} from '../src/core/automation/featureResources';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
import {itemAbilityFloorEntries,itemAbilityFloorFixture,itemAbilityFloorDigest} from './helpers/itemAbilityFloorFixture';
beforeAll(()=>{itemAbilityFloorEntries();});
it('withdraws on exact worn/attuned/source/protocol states without changing persisted data',()=>{
 const mutations:((f:ReturnType<typeof itemAbilityFloorFixture>)=>void)[]=[f=>{f.owner.equipped=false;},f=>{f.owner.attuned=false;},f=>{delete f.owner.attuned;},f=>{f.owner.quantity=2;},f=>{f.owner.parentId='missing';},f=>{f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Retained exception';},f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=999;}];
 for(const mutate of mutations){
  const f=itemAbilityFloorFixture();mutate(f);const before=itemAbilityFloorDigest(f.c);expect(evaluate(f.c).abilities.con).toBe(10);expect(evaluate(f.c).issues.some(i=>i.id.startsWith('item-ability-floor:'))).toBe(true);expect(itemAbilityFloorDigest(f.c)).toBe(before);
 }
});
it('denies forged complete snapshots without poisoning unrelated generic/manual item mechanics',()=>{
 const mutations:((e:Entry)=>void)[]=[e=>{e.source='XDMG';},e=>{e.packId='authored';},e=>{e.edition='2024';},e=>{e.kind='feature';},e=>{e.name+=' authored';},e=>{e.english+=' authored';},e=>{e.page=1;},e=>{e.raw._category='baseitem';},e=>{e.raw.ability.static.con=99;},e=>{e.entries.push('Authored extra clause');},e=>{e.raw.extra=true;},e=>{e.raw._copy={};},e=>{e.raw._unresolvedParent=true;},e=>{e.effects=[{op:'add',target:'ac',value:2}];},e=>{e.dependencies=['AUTHORED'];},e=>{e.id=ordinary.canonicalIds.find(id=>!id.includes('amulet%20of%20health'))!;}];
 for(const mutate of mutations){const f=itemAbilityFloorFixture();mutate(f.entry);const before=itemAbilityFloorDigest(f.c);expect(itemAbilityFloorRule(f.entry)).toBeUndefined();expect(evaluate(f.c).abilities.con).toBe(10);expect(itemAbilityFloorDigest(f.c)).toBe(before);}
 const f=itemAbilityFloorFixture();f.entry.raw.ability.static.con=99;f.entry.effects=[{op:'add',target:'ac',value:2}];expect(evaluate(f.c).ac).toBe(12);
 f.entry.id='authored-foreign';f.entry.source='CUSTOM';f.entry.packId='custom';f.entry.raw._custom=true;expect(projectItemAbilityFloors(f.c).floors).toEqual({});expect(evaluate(f.c).ac).toBe(12);
});
it('rejects duplicate canonical/alias owners and active-list substitutions; removal restores unambiguous ownership',()=>{
 const f=itemAbilityFloorFixture(),duplicate=structuredClone(f.owner);duplicate.id='another-owner';duplicate.entry.id='authored-coherent-alias';f.c.selections.push(duplicate);expect(evaluate(f.c).abilities.con).toBe(10);f.c.selections.pop();
 expect(projectItemAbilityFloors(f.c,[]).floors).toEqual({});expect(projectItemAbilityFloors(f.c,[structuredClone(f.owner)]).floors).toEqual({});expect(evaluate(f.c,new Set([f.owner.id])).abilities.con).toBe(10);
 f.c.selections.push(structuredClone(f.owner));expect(evaluate(f.c).abilities.con).toBe(10);f.c.selections.pop();expect(evaluate(f.c).abilities.con).toBe(19);removeSelection(f.c,f.owner.id);expect(evaluate(f.c).abilities.con).toBe(10);
});
it('takes max across valid distinct floors, never lowers higher natural scores and is independent of row order',()=>{
 const f=itemAbilityFloorFixture('Gauntlets of Ogre Power'),hill=itemAbilityFloorFixture('Belt of Hill Giant Strength'),storm=itemAbilityFloorFixture('Belt of Storm Giant Strength');hill.owner.id='hill';storm.owner.id='storm';f.c.selections.push(hill.owner,storm.owner);
 expect(evaluate(f.c).abilities.str).toBe(29);f.c.selections.reverse();expect(evaluate(f.c).abilities.str).toBe(29);storm.owner.attuned=false;expect(evaluate(f.c).abilities.str).toBe(21);
 f.c.abilities.str=30;expect(evaluate(f.c).abilities.str).toBe(30);expect(evaluate(f.c).naturalAbilities).toBeUndefined();f.c.abilities.str=21;expect(evaluate(f.c).abilities.str).toBe(21);expect(f.c.abilities.str).toBe(21);
});
it('keeps native/linked persistence identical, derives CON HP without healing and preserves manual overrides and offsets',()=>{
 const f=itemAbilityFloorFixture();const [cls]=normalizeData({class:[{name:'Authored class',source:'PHB',hd:{faces:10},proficiency:['con']}]},'authored');f.c.selections.push({id:'class',entry:cls,quantity:1,level:3,equipped:false});f.c.skillBonuses={arcana:2};f.c.saveBonuses={con:3};
 const before=itemAbilityFloorDigest(f.c),d=evaluate(f.c);expect(d.maxHp).toBe(34);expect(d.saves.con.value).toBe(9);expect(d.skills.arcana.value).toBe(2);expect(f.c.runtime.hp).toBe(3);expect(itemAbilityFloorDigest(f.c)).toBe(before);
 for(const file of [exportCharacter(f.c),exportLinkedOwlbear(f.c,d).dnd_card_web]){const reopened=readCharacter(file).character;expect(itemAbilityFloorDigest(reopened)).toBe(before);expect(evaluate(reopened).abilities.con).toBe(19);expect(Object.hasOwn(reopened,'naturalAbilities')).toBe(false);expect(evaluate(reopened).maxHp).toBe(34);}
 f.c.baseHp=50;f.c.adjustments=[{id:'hp',target:'hp',value:61,reason:'Authored HP total'},{id:'save',target:'save:con',value:12,reason:'Authored save total'},{id:'skill',target:'skill:arcana',value:13,reason:'Authored skill total'},{id:'ac',target:'ac',value:17,reason:'Authored AC total'}];f.c.sheetBonuses={hp:2,ac:1};const protectedBefore=itemAbilityFloorDigest(f.c);const manual=evaluate(f.c);expect(manual.maxHp).toBe(63);expect(manual.saves.con.value).toBe(15);expect(manual.skills.arcana.value).toBe(15);expect(manual.ac).toBe(18);expect(itemAbilityFloorDigest(f.c)).toBe(protectedBefore);f.owner.equipped=false;expect(evaluate(f.c).maxHp).toBe(63);expect(f.c.runtime.hp).toBe(3);
});
it('applies after reviewed feat advancement without changing saved feat intent or natural caps',()=>{
 const f=itemAbilityFloorFixture(),entries=normalizeData(structuredClone(reviewedPassiveFeatData),'authored-passive');const cls=entries.find(e=>e.kind==='class')!;f.c.selections.push({id:'fighter',entry:cls,quantity:1,level:4,equipped:false});f.c.abilities.con=13;syncFeatures(f.c,entries);
 const choice=sheetChoices(f.c,entries).find(x=>x.id.includes(':class-legacy-feat:'))!,feat=entries.find(e=>e.english==='Resilient')!;setSheetChoiceSlot(f.c,choice.id,0,feat.id,entries);setReviewedFeatIntent(f.c,choice.id,feat.id,{kind:'resilient',ability:'con',confirmedManualAbilityExcluded:true});const before=itemAbilityFloorDigest(f.c),d=evaluate(f.c);
 expect(d.naturalAbilities?.con).toBe(14);expect(d.abilities.con).toBe(19);expect(d.saves.con.proficient).toBe(true);expect(itemAbilityFloorDigest(f.c)).toBe(before);f.owner.attuned=false;expect(evaluate(f.c).abilities.con).toBe(14);
});
it('natural ASI caps are unaffected by a temporary29 floor',()=>{
 const f=itemAbilityFloorFixture('Belt of Storm Giant Strength','XDMG'),entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'XPHB',classFeatures:[4,6].map(n=>`属性值提升|战士|XPHB|${n}`)}],classFeature:[4,6].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',className:'战士',classSource:'XPHB',level,entries:['你获得{@feat 属性值提升|XPHB}专长。']})),feat:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,prerequisite:[{level:4}],ability:[{choose:{from:[...ABILITIES],amount:2},hidden:true},{choose:{from:[...ABILITIES],count:2},hidden:true}],entries:[]}]},'asi-authored');
 f.c.selections.push({id:'fighter',entry:entries.find(e=>e.kind==='class')!,level:6,quantity:1,equipped:false});f.c.abilities.str=18;syncFeatures(f.c,entries);const choices=sheetChoices(f.c,entries).filter(x=>x.id.includes(':class-typed-feat:')),feat=entries.find(e=>e.kind==='feat')!;for(const choice of choices)setSheetChoiceSlot(f.c,choice.id,0,feat.id,entries);syncChoiceContent(f.c,entries);
 expect(baseAbilityScores(f.c,activeEffectSelections(f.c)).abilities.str).toBe(18);setAsiAllocation(f.c,choices[0].id,{str:2});expect(asiAllocationStatus(f.c,choices[0].id).active).toBe(true);expect(evaluate(f.c).naturalAbilities?.str).toBe(20);expect(evaluate(f.c).abilities.str).toBe(29);expect(()=>setAsiAllocation(f.c,choices[1].id,{str:2})).toThrow();f.owner.equipped=false;expect(evaluate(f.c).abilities.str).toBe(20);
});
it('holds newly equipment-only prerequisite eligibility as missing policy, preserving natural branches, OR alternatives and saved choices',()=>{
 const f=itemAbilityFloorFixture('Headband of Intellect'),[cls,feat]=normalizeData({class:[{name:'Authored owner',source:'PHB'}],feat:[{name:'Authored candidate',source:'PHB',prerequisite:[{ability:[{int:13}]}]}]},'authored-prerequisite');const owner={id:'class',entry:cls,quantity:1,level:4,equipped:false};f.c.selections.push(owner);f.c.answers['authored-choice']=[feat.id];const before=itemAbilityFloorDigest(f.c);
 expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toContain('政策尚未受审');expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toContain('不表示规则禁止');expect(itemAbilityFloorDigest(f.c)).toBe(before);
 feat.raw.prerequisite=[{ability:[{int:13},{str:10}]}];expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toBeUndefined();feat.raw.prerequisite=[{ability:[{int:13}]},{level:4}];expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toBeUndefined();
 feat.raw.prerequisite=[{ability:[{int:13}]}];f.c.abilities.int=13;expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toBeUndefined();f.c.abilities.int=10;f.owner.equipped=false;expect(sourceChoicePrerequisite(f.c,feat,owner,false)).toContain('尚未满足');expect(f.c.answers['authored-choice']).toEqual([feat.id]);
});
it('coherently feeds effective STR automatic weapon damage/hit and INT spell values while preserving manual attack formulas',()=>{
 const f=itemAbilityFloorFixture('Gauntlets of Ogre Power'),head=itemAbilityFloorFixture('Headband of Intellect');head.owner.id='head';f.c.selections.push(head.owner);f.c.training={weapons:'简易武器'};const [weapon]=normalizeData({item:[{name:'Authored finesse weapon',source:'PHB',type:'M',weaponCategory:'simple',dmg1:'1d6',property:['F']}]},'authored');f.c.selections.push({id:'weapon',entry:weapon,quantity:1,level:1,equipped:true});f.c.abilities.dex=14;f.c.spellSettings={mode:'known',ability:'int',capacity:0,attackBonus:1,dcBonus:2,prepared:[],slots:{}};
 let d=evaluate(f.c);expect(automaticWeaponAttacks(f.c,d).attacks[0]).toMatchObject({attack_bonus:6,damage:'1d6+4'});expect(spellValues(f.c,d)).toEqual({attack:7,dc:16});f.c.quickbarActions=[{id:'manual',name:'Authored manual attack',attack:'+11',damage:'2d8+9'}];expect(weaponAttacks(f.c,d).find(a=>a.key==='custom:manual')).toMatchObject({attack_bonus:'+11',damage:'2d8+9'});
 f.owner.equipped=false;head.owner.attuned=false;d=evaluate(f.c);expect(automaticWeaponAttacks(f.c,d).attacks[0]).toMatchObject({attack_bonus:4,damage:'1d6+2'});expect(spellValues(f.c,d)).toEqual({attack:3,dc:12});
});
it('explicitly leaves formula resource capacity and spent balance manual rather than claiming equipment support',()=>{
 const f=itemAbilityFloorFixture('Headband of Intellect'),[entry]=normalizeData({class:[{name:'Authored resource owner',source:'PHB',resources:[{name:'Authored formula resource',max:'@abilities.int.mod + 2',recovery:'manual'}]}]},'authored-resource');f.c.selections.push({id:'resource-owner',entry,quantity:1,level:1,equipped:false});const before=itemAbilityFloorDigest(f.c),without=structuredClone(f.c);without.selections[0].equipped=false;
 expect(planFeatureResources(f.c).grants.map(g=>g.max)).toEqual(planFeatureResources(without).grants.map(g=>g.max));expect(evaluate(f.c).issues.some(i=>i.id==='item-ability-floor:resource-policy'&&i.message.includes('尚未受审'))).toBe(true);expect(itemAbilityFloorDigest(f.c)).toBe(before);expect(f.c.runtime.resources.manual.current).toBe(1);
});
