import {beforeAll,expect,it} from 'vitest';
import {type Entry,type Selection} from '../src/core/model';
import {projectItemCastingBonuses,itemCastingBonusFamilyId,itemCastingBonusRule,itemCastingBonusSnapshot} from '../src/core/automation/itemCastingBonuses';
import {itemCastingBonusFixture} from './helpers/itemCastingBonusFlowFixture';
import {itemCastingBonusClass,itemCastingBonusSpecs,itemCastingBonusSourceEvidence,itemCastingBonusSnapshot as sourceSnapshot,type ItemCastingBonusRole,type ItemCastingBonusSpec} from './helpers/itemCastingBonusSourceFixture';

type Fixture=ReturnType<typeof itemCastingBonusFixture>;
type Projection=ReturnType<typeof projectItemCastingBonuses>;
type Context=Parameters<typeof projectItemCastingBonuses>[1];
beforeAll(()=>{itemCastingBonusSourceEvidence();},30000);
function numbers(actual:Pick<Projection,'attackBonus'|'dcBonus'>,expected:Pick<ItemCastingBonusSpec,'attackBonus'|'dcBonus'>){expect(actual.attackBonus).toBe(expected.attackBonus);expect(actual.dcBonus).toBe(expected.dcBonus);}
function zero(actual:Projection){numbers(actual,{attackBonus:0,dcBonus:0});expect(actual.grants).toHaveLength(0);}
function context(f:Fixture):Context{return{ability:f.ability,casterId:f.caster.id};}
function addClass(f:Fixture,role:ItemCastingBonusRole,id:string,edition:'2014'|'2024'=f.c.edition as '2014'|'2024',level=5):Selection{
 const entry=structuredClone(itemCastingBonusClass(role,edition)),row:Selection={id,entry,quantity:1,level,equipped:false};f.c.selections.push(row);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,entry.source,...(entry.dependencies||[])])];return row;
}
function addItem(f:Fixture,sourceIndex:number,id:string):Selection{
 const other=itemCastingBonusFixture(sourceIndex),row=structuredClone(other.owner);row.id=id;f.c.selections.push(row);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,other.entry.source,...(other.entry.dependencies||[])])];return row;
}
function fullFreeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(fullFreeze);Object.freeze(value);}}

it('projects all nine complete canonical and App forms from independent source attack and DC numbers',()=>{
 expect(itemCastingBonusSpecs).toHaveLength(9);
 for(const form of ['canonical','app']as const)for(const spec of itemCastingBonusSpecs){
  const f=itemCastingBonusFixture(spec.sourceIndex,form),before=sourceSnapshot(f.c),actual=projectItemCastingBonuses(f.c,context(f));
  expect(itemCastingBonusFamilyId(f.entry)).toBe(f.rule.id);expect(itemCastingBonusRule(f.entry)?.id).toBe(f.rule.id);numbers(actual,spec);expect(actual.resolvedCasterId).toBe(f.caster.id);expect(actual.grants).toHaveLength(1);
  const grant=actual.grants[0];expect(grant.selectionId).toBe(f.owner.id);expect(grant.entryId).toBe(f.rule.id);expect(grant.casterId).toBe(f.caster.id);expect(grant.scope).toBe(spec.scope);expect(grant.source).toBe(f.entry.source);expect(grant.attunementOwnerIds).toContain(f.caster.id);expect(grant.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);numbers(grant,spec);
  expect(Array.isArray(actual.attackTrace)).toBe(true);expect(actual.attackTrace.length).toBeGreaterThan(0);expect(Array.isArray(actual.dcTrace)).toBe(true);expect(actual.dcTrace.length).toBeGreaterThan(0);expect(actual.issues).toHaveLength(0);expect(sourceSnapshot(f.c)).toBe(before);
 }
});
it('requires the actual single physical item to be currently worn and attuned without manufacturing ownership',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.owner.equipped=false;},f=>{f.owner.attuned=false;},f=>{(f.owner as any).equipped=1;},f=>{(f.owner as any).attuned=1;},f=>{delete f.owner.attuned;},f=>{f.owner.quantity=0;},f=>{f.owner.quantity=2;},f=>{f.owner.quantity=1.5;},f=>{f.owner.parentId='authored-missing-parent';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-granted-item';},f=>{f.owner.requirementId='authored-choice-owned-item';}];
 for(const change of changes){const f=itemCastingBonusFixture();change(f);const before=sourceSnapshot(f.c);zero(projectItemCastingBonuses(f.c,context(f)));expect(sourceSnapshot(f.c)).toBe(before);}
});
it('requires complete item proof, accepts coherent unreserved aliases and respects canonical identity opt-outs',()=>{
 const f=itemCastingBonusFixture(),canonical=f.rule.id;f.entry.id='authored-casting-item-alias';f.entry.revision='authored-compatible-transport-revision';expect(itemCastingBonusRule(f.entry)?.id).toBe(canonical);numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);
 for(const id of [canonical,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectItemCastingBonuses(f.c,context(f)));}delete f.c.profile.disabledEntries;
 f.entry.id=f.caster.entry.id;expect(itemCastingBonusRule(f.entry)).toBeUndefined();zero(projectItemCastingBonuses(f.c,context(f)));
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw.authoredExtra=true;},entry=>{entry.raw.reqAttune=true;},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.kind='feat';},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition=entry.edition==='2024'?'2014':'2024';},entry=>{entry.page=(entry.page??0)+1;},entry=>{entry.english+=' Authored';},entry=>{entry.name+=' Authored';},entry=>{(entry as any).effects=[...(entry.effects||[]),{type:'authored-extra'}];},entry=>{(entry as any).choices=[...(entry.choices||[]),{id:'authored-extra'}];},entry=>{(entry as any).authoredUnexpectedField=true;}];
 for(const change of changes){const next=itemCastingBonusFixture(),before=itemCastingBonusSnapshot(next.entry);change(next.entry);expect(itemCastingBonusSnapshot(next.entry)).not.toBe(before);expect(itemCastingBonusRule(next.entry)).toBeUndefined();zero(projectItemCastingBonuses(next.c,context(next)));}
 const foreign=itemCastingBonusFixture();foreign.entry.id='authored-foreign-same-name';foreign.entry.packId='authored-foreign';foreign.entry.source='AUTHORED';foreign.entry.raw.source='AUTHORED';foreign.entry.raw.bonusSpellAttack=99;foreign.entry.raw.bonusSpellSaveDc=99;foreign.c.profile.enabledSources.push('AUTHORED');expect(itemCastingBonusFamilyId(foreign.entry)).toBeUndefined();zero(projectItemCastingBonuses(foreign.c,context(foreign)));
});
it('holds paused or unknown automation, unavailable item sources and duplicate current ownership',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==f.entry.source);},f=>{f.c.profile.disabledEntries=[f.rule.id];},f=>{const copy=structuredClone(f.owner);copy.id='authored-second-item-root';f.c.selections.push(copy);},f=>{const copy=structuredClone(f.owner);copy.id='authored-second-item-alias-root';copy.entry.id='authored-second-item-alias';f.c.selections.push(copy);},f=>{f.c.selections.push(structuredClone(f.owner));}];
 for(const change of changes){const f=itemCastingBonusFixture();change(f);const before=sourceSnapshot(f.c);zero(projectItemCastingBonuses(f.c,context(f)));expect(sourceSnapshot(f.c)).toBe(before);}
 const f=itemCastingBonusFixture();f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==f.entry.source);f.c.profile.exceptions[f.entry.id]='Authored exception cannot replace active source proof';zero(projectItemCastingBonuses(f.c,context(f)));
});
it('resolves explicit, stored and sole proven caster contexts without manual or ambiguous fallback',()=>{
 const blood=itemCastingBonusFixture(3),markerCases=[{marker:'sourceSelectionId',value:{ability:blood.ability,casterId:blood.caster.id,sourceSelectionId:undefined}},{marker:'casterId',value:{ability:blood.ability,casterId:undefined}}];
 for(const {marker,value}of markerCases){const before=sourceSnapshot(blood.c),actual=projectItemCastingBonuses(blood.c,value);expect.soft(actual.attackBonus,marker).toBe(0);expect.soft(actual.dcBonus,marker).toBe(0);expect.soft(actual.grants.length,marker).toBe(0);expect(sourceSnapshot(blood.c)).toBe(before);}
 const f=itemCastingBonusFixture();numbers(projectItemCastingBonuses(f.c,{ability:f.ability}),f.spec);f.c.spellSettings!.abilityClassId='authored-stale-stored-caster';zero(projectItemCastingBonuses(f.c,{ability:f.ability}));numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);zero(projectItemCastingBonuses(f.c,{ability:f.ability,casterId:'authored-missing-explicit-caster'}));
 delete f.c.spellSettings!.abilityClassId;numbers(projectItemCastingBonuses(f.c,{ability:f.ability}),f.spec);const other=addClass(f,'Druid','authored-second-native-caster');zero(projectItemCastingBonuses(f.c,{ability:f.ability}));numbers(projectItemCastingBonuses(f.c,{ability:f.ability,casterId:other.id}),f.spec);
 zero(projectItemCastingBonuses(f.c,{ability:'int',casterId:f.caster.id}));f.c.spellSettings!.abilityOverride=true;f.c.spellSettings!.ability='int';zero(projectItemCastingBonuses(f.c,{ability:'int',casterId:f.caster.id}));numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);
 for(const kind of ['class','subclass']as const){
  const next=itemCastingBonusFixture(1153);delete next.c.spellSettings!.abilityClassId;const manual=structuredClone(next.caster);manual.id='authored-unproved-potential-caster';manual.entry.id='authored-unproved-'+kind;manual.entry.kind=kind;manual.entry.packId='authored-manual';manual.entry.source='AUTHORED';manual.entry.raw.source='AUTHORED';next.c.profile.enabledSources.push('AUTHORED');next.c.selections.push(manual);zero(projectItemCastingBonuses(next.c,{ability:'cha'}));numbers(projectItemCastingBonuses(next.c,context(next)),next.spec);
 }
 for(const sourceSelectionId of [f.owner.id,'authored-item-or-special-source'])zero(projectItemCastingBonuses(f.c,{...context(f),sourceSelectionId}));
});
it('keeps class attunement roles separate from all-spell recipients and permits a genuine level-one Paladin qualifier',()=>{
 for(const edition of ['2014','2024']as const){
  const f=itemCastingBonusFixture();f.c.edition=edition;f.c.selections=f.c.selections.filter(row=>row.id!==f.caster.id);const qualifier=addClass(f,'Paladin','authored-paladin-qualifier',edition,1),druid=addClass(f,'Druid','authored-druid-recipient',edition);
  const actual=projectItemCastingBonuses(f.c,{ability:'wis',casterId:druid.id});numbers(actual,f.spec);expect(actual.resolvedCasterId).toBe(druid.id);expect(actual.grants[0].attunementOwnerIds).toContain(qualifier.id);expect(actual.grants[0].attunementOwnerIds).not.toContain(druid.id);
  for(const quantity of [0,2]){qualifier.quantity=quantity;druid.quantity=quantity;numbers(projectItemCastingBonuses(f.c,{ability:'wis',casterId:druid.id}),f.spec);}f.c.selections=f.c.selections.filter(row=>row.id!==qualifier.id);zero(projectItemCastingBonuses(f.c,{ability:'wis',casterId:druid.id}));
 }
 for(const sourceIndex of [1843,1845]){const f=itemCastingBonusFixture(sourceIndex),druid=addClass(f,'Druid','authored-global-druid-recipient');numbers(projectItemCastingBonuses(f.c,{ability:'wis',casterId:druid.id}),f.spec);f.c.selections=f.c.selections.filter(row=>row.id!==f.caster.id);zero(projectItemCastingBonuses(f.c,{ability:'wis',casterId:druid.id}));}
});
it('limits Bloodwell to actual Sorcerer spells and Jester to actual Charisma class provenance',()=>{
 const blood=itemCastingBonusFixture(3);numbers(projectItemCastingBonuses(blood.c,context(blood)),blood.spec);
 for(const role of ['Bard','Warlock']as const){const recipient=addClass(blood,role,'authored-blood-recipient-'+role);zero(projectItemCastingBonuses(blood.c,{ability:'cha',casterId:recipient.id}));}
 const jester=itemCastingBonusFixture(1153);for(const role of ['Bard','Sorcerer','Warlock']as const){const recipient=role==='Bard'?jester.caster:addClass(jester,role,'authored-jester-recipient-'+role);numbers(projectItemCastingBonuses(jester.c,{ability:'cha',casterId:recipient.id}),jester.spec);}
 const druid=addClass(jester,'Druid','authored-jester-wisdom-recipient');zero(projectItemCastingBonuses(jester.c,{ability:'wis',casterId:druid.id}));jester.c.spellSettings!.abilityOverride=true;jester.c.spellSettings!.ability='cha';zero(projectItemCastingBonuses(jester.c,{ability:'cha',casterId:druid.id}));
});
it('requires current unique native base-class proof without inventing item quantity or equipment gates for classes',()=>{
 for(const collision of ['class-class','class-item']as const){const f=itemCastingBonusFixture(3);if(collision==='class-class')addClass(f,'Warlock',f.caster.id);else f.owner.id=f.caster.id;const before=sourceSnapshot(f.c);zero(projectItemCastingBonuses(f.c,{ability:'cha',casterId:f.caster.id}));expect(sourceSnapshot(f.c)).toBe(before);}
 const alias=itemCastingBonusFixture(),canonical=alias.caster.entry.id;alias.caster.entry.id='authored-coherent-class-alias';alias.caster.entry.revision='authored-class-transport-revision';numbers(projectItemCastingBonuses(alias.c,context(alias)),alias.spec);alias.c.profile.disabledEntries=[canonical];zero(projectItemCastingBonuses(alias.c,context(alias)));delete alias.c.profile.disabledEntries;
 for(const quantity of [0,2]){alias.caster.quantity=quantity;alias.caster.equipped=false;numbers(projectItemCastingBonuses(alias.c,context(alias)),alias.spec);}
 const changes:((f:Fixture)=>void)[]=[f=>{f.caster.entry.raw.authoredExtra=true;},f=>{f.caster.entry.raw.spellcastingAbility='cha';},f=>{f.caster.entry.entries=[...f.caster.entry.entries,'Authored class change'];},f=>{(f.caster.entry as any).effects=[...(f.caster.entry.effects||[]),{type:'authored-extra'}];},f=>{f.caster.entry.kind='subclass';},f=>{f.caster.entry.id=f.entry.id;},f=>{f.caster.entry.packId='authored-foreign';},f=>{f.caster.entry.source='AUTHORED';},f=>{f.caster.entry.page=(f.caster.entry.page??0)+1;},f=>{f.caster.entry.edition='2024';},f=>{f.caster.level=0;},f=>{f.caster.level=21;},f=>{f.caster.level=1.5;},f=>{f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==f.caster.entry.source);},f=>{const copy=structuredClone(f.caster);copy.id='authored-duplicate-class-proof';f.c.selections.push(copy);},f=>{f.c.selections.push(structuredClone(f.caster));}];
 for(const change of changes){const f=itemCastingBonusFixture();change(f);const before=sourceSnapshot(f.c);zero(projectItemCastingBonuses(f.c,context(f)));expect(sourceSnapshot(f.c)).toBe(before);}
});
it('holds only simultaneous otherwise-eligible reviewed rank members and stacks independent qualifying scopes',()=>{
 for(const pair of [{first:1,second:15,group:'amulet-of-the-devout-ranks'},{first:3,second:17,group:'bloodwell-vial-ranks'}]){
  const f=itemCastingBonusFixture(pair.first);expect(f.rule.rankOverlapGroup).toBe(pair.group);numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);const other=addItem(f,pair.second,'authored-other-rank-owner');expect(itemCastingBonusRule(other.entry)?.rankOverlapGroup).toBe(pair.group);const overlap=projectItemCastingBonuses(f.c,context(f));zero(overlap);expect(overlap.issues.length).toBeGreaterThan(0);
  for(const condition of ['unattuned','unequipped','disabled']as const){other.attuned=true;other.equipped=true;delete f.c.profile.disabledEntries;if(condition==='unattuned')other.attuned=false;if(condition==='unequipped')other.equipped=false;if(condition==='disabled')f.c.profile.disabledEntries=[other.entry.id];numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);}
 }
 const f=itemCastingBonusFixture(1),blood=addItem(f,3,'authored-independent-blood-owner'),sorcerer=addClass(f,'Sorcerer','authored-independent-sorcerer');numbers(projectItemCastingBonuses(f.c,{ability:'cha',casterId:sorcerer.id}),{attackBonus:2,dcBonus:2});expect(projectItemCastingBonuses(f.c,{ability:'cha',casterId:sorcerer.id}).grants).toHaveLength(2);numbers(projectItemCastingBonuses(f.c,context(f)),f.spec);expect(itemCastingBonusRule(blood.entry)?.scope).toBe('sorcerer-spells');
});
it('is a pure read of frozen locked cards and preserves native manual values, notes, resources and class selections',()=>{
 for(const sourceIndex of [1,3,1153,1845]){const f=itemCastingBonusFixture(sourceIndex);f.c.locked=true;f.c.saveBonuses={str:9};f.c.sheetBonuses={ac:7};const before=sourceSnapshot(f.c),manual=sourceSnapshot([f.c.runtime,f.c.notes,f.c.spellSettings,f.c.selections]);fullFreeze(f.c);let actual:Projection|undefined;expect(()=>{actual=projectItemCastingBonuses(f.c,context(f));}).not.toThrow();numbers(actual!,f.spec);expect(sourceSnapshot(f.c)).toBe(before);expect(sourceSnapshot([f.c.runtime,f.c.notes,f.c.spellSettings,f.c.selections])).toBe(manual);}
});
