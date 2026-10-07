import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import fixture from './fixtures/preDedupClassChoice.json' with {type:'json'};
import {validateCharacter} from '../src/core/validation';
import {sheetChoices,syncChoiceContent,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {evaluate} from '../src/core/engine';
import type {Entry} from '../src/core/model';

const ids=fixture.ids;
const originalResource=Object.values(fixture.character.runtime.resources)[0];
function setup(){return {c:validateCharacter(structuredClone(fixture.character)),entries:structuredClone(fixture.entries) as Entry[]};}
function assertOriginalTree(c:ReturnType<typeof setup>['c']){
 const old=fixture.character.selections.find(row=>row.id===ids.feat)!;
 expect(c.selections.find(row=>row.id===ids.feat),'the existing chosen feat identity must survive').toBeDefined();
 expect(c.selections.find(row=>row.id===ids.feat)!.grantKey).toBe(old.grantKey);
 for(const row of fixture.character.selections.filter(row=>row.id===ids.child||row.parentId===ids.child||row.id==='authored-manual-child'))expect(c.selections.find(current=>current.id===row.id)).toEqual(row);
 for(const [id,answer] of Object.entries(fixture.character.answers))expect(c.answers[id]).toEqual(answer);
 expect(c.quickbar).toEqual(fixture.character.quickbar);expect(c.featureLayout).toEqual(fixture.character.featureLayout);expect(c.quickbarLayout).toEqual(fixture.character.quickbarLayout);
 expect(c.notes).toBe(fixture.character.notes);expect(c.abilities).toEqual(fixture.character.abilities);expect(c.runtime.hp).toBe(3);
 expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);expect(evaluate(c).ac).toBe(12);expect(evaluate(c).skills.arcana.proficient).toBe(true);
}
it('preserves a pre-fix real sync-generated grant tree, nested answers and runtime references when deduplicating',()=>{
 const {c,entries}=setup(),old=c.selections.find(row=>row.id===ids.feat)!;
 expect(fixture.producerCommit).toBe('1a1717f84d9774f34194b9e57a45c247980cfba2');expect(old.parentId).toBe(ids.feature);expect(old.requirementId).toBe(ids.filterChoice);expect(old.grantKey).toBe(`choice:${ids.filterChoice}:${old.entry.id}`);
 syncChoiceContent(c,entries);syncAutoResources(c);assertOriginalTree(c);expect(c.runtime.resources[ids.resource]).toEqual(originalResource);
 expect(syncChoiceContent(c,entries)).toBe(false);expect(sheetChoices(c,entries).filter(choice=>choice.sourceProgression==='feat')).toHaveLength(1);
});
it('parks a real level-two grant while downgraded, then restores its original tree and consumed resources after import',()=>{
 const {c,entries}=setup();syncFeatures(c,entries);syncAutoResources(c);assertOriginalTree(c);
 const choice=sheetChoices(c,entries).find(choice=>choice.sourceProgression==='feat')!;expect(c.answers[choice.id]).toEqual([c.selections.find(row=>row.id===ids.feat)!.entry.id]);
 c.selections.find(row=>row.id==='class-owner')!.level=1;syncFeatures(c,entries);syncAutoResources(c);
 expect(c.selections.some(row=>row.id===ids.feat||row.id==='authored-manual-child')).toBe(false);expect(evaluate(c).ac).toBe(10);expect(evaluate(c).skills.arcana.proficient).toBe(false);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections.find(row=>row.id==='class-owner')!.level=2;syncFeatures(restored,entries);syncAutoResources(restored);
 assertOriginalTree(restored);expect(restored.runtime.resources[ids.resource]).toEqual(originalResource);expect(sheetChoices(restored,entries).find(row=>row.id===choice.id)!.complete).toBe(true);
});
it('preserves pinned references to the retained source feature during automatic level removal',()=>{
 const {c,entries}=setup();syncFeatures(c,entries);c.quickbar!.push(ids.feature);c.featureLayout!.order.push(ids.feature);c.featureLayout!.expanded.push(ids.feature);
 const quickbar=[...c.quickbar!],layout=structuredClone(c.featureLayout);c.selections.find(row=>row.id==='class-owner')!.level=1;syncFeatures(c,entries);
 expect(c.quickbar).toEqual(quickbar);expect(c.featureLayout).toEqual(layout);expect(c.selections.some(row=>row.id===ids.feature)).toBe(false);
 c.selections.find(row=>row.id==='class-owner')!.level=2;syncFeatures(c,entries);expect(c.selections.some(row=>row.id===ids.feature)).toBe(true);expect(c.quickbar).toEqual(quickbar);
});
it('preserves the original grant tree when the first new-version hydration already starts below its grant level',()=>{
 const {c,entries}=setup();c.selections.find(row=>row.id==='class-owner')!.level=1;syncFeatures(c,entries);syncAutoResources(c);expect(evaluate(c).ac).toBe(10);
 c.selections.find(row=>row.id==='class-owner')!.level=2;syncFeatures(c,entries);syncAutoResources(c);assertOriginalTree(c);expect(c.runtime.resources[ids.resource].current).toBe(1);
});

it.each(['source','empty catalog'] as const)('retains old identities and resource consumption through %s restriction and native import',mode=>{
 const {c,entries}=setup(),sources=[...c.profile.enabledSources];syncFeatures(c,entries);syncAutoResources(c);
 const catalog=mode==='empty catalog'?[]:entries;
 if(mode==='source')c.profile.enabledSources=[];else c.selections.find(row=>row.id==='class-owner')!.level=1;
 syncFeatures(c,catalog);syncAutoResources(c);expect(evaluate(c).ac).toBe(10);expect(evaluate(c).skills.arcana.proficient).toBe(false);
 expect(c.classChoiceArchive![ids.feat].selections.some(row=>row.id==='authored-manual-child')).toBe(true);
 const imported=validateCharacter(JSON.parse(JSON.stringify(c)));imported.profile.enabledSources=sources;imported.selections.find(row=>row.id==='class-owner')!.level=2;
 syncFeatures(imported,catalog);syncAutoResources(imported);assertOriginalTree(imported);expect(imported.runtime.resources[ids.resource]).toEqual(originalResource);
 expect(syncChoiceContent(imported,catalog)).toBe(false);
});
it('keeps a cleared canonical answer authoritative and restores its old subtree only after explicit reselection',()=>{
 const {c,entries}=setup();syncFeatures(c,entries);syncAutoResources(c);const choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='feat')!,value=c.selections.find(row=>row.id===ids.feat)!.entry.id;
 setSheetChoiceSlot(c,choice.id,0,undefined,entries);syncChoiceContent(c,entries);syncAutoResources(c);expect(evaluate(c).ac).toBe(10);
 expect(c.answers[ids.filterChoice]).toEqual([value]);expect(c.answers[choice.id]).toEqual(['']);expect(syncChoiceContent(c,entries)).toBe(false);
 setSheetChoiceSlot(c,choice.id,0,value,entries);syncFeatures(c,entries);syncAutoResources(c);assertOriginalTree(c);expect(c.runtime.resources[ids.resource].current).toBe(1);
});
it('does not create a replacement grant when its old source feature remains explicitly dismissed',()=>{
 const {c,entries}=setup();syncFeatures(c,entries);const owner=c.selections.find(row=>row.id==='class-owner')!,parent=c.selections.find(row=>row.id===ids.feature)!;
 owner.level=1;syncFeatures(c,entries);c.dismissedFeatures=[`${owner.id}|${parent.grantKey}`];owner.level=2;syncFeatures(c,entries);
 expect(c.classChoiceArchive![ids.feat]).toBeDefined();expect(c.selections.some(row=>row.entry.kind==='feat')).toBe(false);expect(evaluate(c).ac).toBe(10);
 expect(sheetChoices(c,entries).find(row=>row.sourceProgression==='feat')!.complete).toBe(false);
 expect(syncChoiceContent(c,entries)).toBe(false);
 c.dismissedFeatures=[];syncFeatures(c,entries);syncAutoResources(c);assertOriginalTree(c);expect(c.runtime.resources[ids.resource].current).toBe(1);
});
it('leaves historical duplicate automatic identities parked with only one active effect and stable repeated hydration',()=>{
 const {c,entries}=setup(),old=c.selections.find(row=>row.id===ids.feat)!;
 // A second historical filter answer granted the same nonrepeatable feat before
 // deduplication. Its distinct identity and attached manual note must survive.
 const feature=c.selections.find(row=>row.id===ids.feature)!;feature.entry.entries.push(structuredClone(feature.entry.entries[0]));
 const alias=`${feature.id}:filter:1`,duplicate={...structuredClone(old),id:'authored-old-duplicate',requirementId:alias,grantKey:`choice:${alias}:${old.entry.id}`};
 c.answers[alias]=[old.entry.id];c.selections.push(duplicate,{...structuredClone(c.selections.find(row=>row.id==='authored-manual-child')!),id:'authored-duplicate-manual',parentId:duplicate.id});
 syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);expect(evaluate(c).ac).toBe(12);
 expect(c.classChoiceArchive![duplicate.id].selections.some(row=>row.id==='authored-duplicate-manual')).toBe(true);expect(syncChoiceContent(c,entries)).toBe(false);
});
it.each(['duplicate identity','disconnected child','invalid parent'] as const)('rejects %s in inactive grant import without mutating the input',mode=>{
 const {c,entries}=setup();syncFeatures(c,entries);c.selections.find(row=>row.id==='class-owner')!.level=1;syncFeatures(c,entries);
 const archive=c.classChoiceArchive![ids.feat];
 if(mode==='duplicate identity')c.selections.push(structuredClone(archive.selections[0]));
 else if(mode==='disconnected child')archive.selections.at(-1)!.parentId='missing-parent';
 else archive.parent!.quantity=100001;
 const before=JSON.stringify(c);expect(()=>validateCharacter(c)).toThrow();expect(JSON.stringify(c)).toBe(before);
});

const realDirectory=process.env.DND_CLASS_CHOICE_PRE_DEDUP_DATA;
it.skipIf(!realDirectory).each([['paladin',2],['ranger',2],['warlock',19]] as const)('restores an actual pre-fix %s grant through %s → one level lower → original level', (name,level)=>{
 const old=JSON.parse(readFileSync(`${realDirectory}/${name}.json`,'utf8')),entries=old.entries as Entry[],c=validateCharacter(structuredClone(old.character));
 expect(old.producerCommit).toBe('1a1717f84d9774f34194b9e57a45c247980cfba2');expect(old.level).toBe(level);
 const original=c.selections.find(row=>row.id===old.ids.feat)!;expect(original.parentId).toBe(old.ids.feature);expect(original.requirementId).toBe(old.ids.choice);
 syncFeatures(c,entries);const choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='feat'&&row.selected.includes(original.entry.id))!;
 expect(c.selections.find(row=>row.id===original.id)!.grantKey).toBe(original.grantKey);expect(evaluate(c).ac).toBe(12);
 c.selections.find(row=>row.id==='class-owner')!.level=level-1;syncFeatures(c,entries);expect(evaluate(c).ac).toBe(10);expect(c.selections.some(row=>row.id===original.id)).toBe(false);
 const imported=validateCharacter(JSON.parse(JSON.stringify(c)));imported.selections.find(row=>row.id==='class-owner')!.level=level;syncFeatures(imported,entries);
 const restored=imported.selections.find(row=>row.id===original.id)!;expect(restored).toBeDefined();expect(restored.grantKey).toBe(original.grantKey);expect(restored.parentId).toBe(original.parentId);
 expect(imported.answers[old.ids.choice]).toEqual(old.character.answers[old.ids.choice]);expect(imported.answers[choice.id]).toEqual([original.entry.id]);expect(sheetChoices(imported,entries).find(row=>row.id===choice.id)!.complete).toBe(true);
 expect(imported.selections.filter(row=>row.entry.id===original.entry.id)).toHaveLength(1);expect(evaluate(imported).ac).toBe(12);expect(syncChoiceContent(imported,entries)).toBe(false);
});
