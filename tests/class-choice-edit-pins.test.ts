import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import fixture from './fixtures/preDedupClassChoice.json' with {type:'json'};
import {validateCharacter} from '../src/core/validation';
import {initializeAutomation} from '../src/core/automation/state';
import {hydrateImportedCasting} from '../src/core/castingSnapshot';
import {rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {reconcileEquipping} from '../src/core/automation/equipment';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {syncAutoResources} from '../src/core/resources';
import {ensureResourceWidget} from '../src/core/resourceWidgets';
import {quickbarEntries,pruneQuickbar,removePin} from '../src/core/quickbar';
import {evaluate} from '../src/core/engine';
import type {Character,Entry} from '../src/core/model';

// Same mechanical order as App.edit, including its final quickbar cleanup.
// This is a synchronous edit-pipeline regression, not a browser QA claim.
function editLikeApp(before:Character,entries:Entry[],action:(draft:Character)=>void){
 const draft=structuredClone(before),defaultChanged=initializeAutomation(draft);
 hydrateImportedCasting(draft,entries);
 if(defaultChanged){syncFeatures(draft,entries);syncAutoResources(draft,before);}
 rememberSourceSpellUses(draft);action(draft);reconcileEquipping(before,draft);
 syncFeatures(draft,entries);syncSourceSpells(draft,entries);syncAutoResources(draft,before);
 for(const id of Object.keys(draft.runtime.resources))if(!Object.hasOwn(before.runtime.resources,id))ensureResourceWidget(draft,id);
 pruneQuickbar(draft);
 return validateCharacter(draft);
}
function assertPinsAfterCycle(initial:Character,entries:Entry[],pins:string[],resource:string,feat:string,level:number){
 initial.quickbar=pins;const baseline=editLikeApp(initial,entries,()=>{}),saved=structuredClone(baseline.runtime.resources[resource]);
 expect(saved.current).toBe(1);expect(saved.max).toBe(3);expect(evaluate(baseline).ac).toBe(12);
 const down=editLikeApp(baseline,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=level-1;});
 expect(down.quickbar,'App edit cleanup must retain inactive tree and source-parent pins').toEqual(pins);
 expect(evaluate(down).ac).toBe(10);expect(quickbarEntries(down).some(row=>pins.includes(row.id))).toBe(false);expect(down.runtime.resources[resource]).toBeUndefined();
 const restored=editLikeApp(validateCharacter(JSON.parse(JSON.stringify(down))),entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=level;});
 expect(restored.quickbar).toEqual(pins);expect(quickbarEntries(restored).map(row=>row.id)).toEqual(pins);
 expect(restored.runtime.resources[resource]).toEqual(saved);expect(evaluate(restored).ac).toBe(12);expect(restored.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);
 for(const id of pins)expect(restored.selections.find(row=>row.id===id)).toEqual(baseline.selections.find(row=>row.id===id));
 expect(restored.answers).toEqual(baseline.answers);expect(restored.featureLayout).toEqual(baseline.featureLayout);expect(restored.quickbarLayout).toEqual(baseline.quickbarLayout);
 expect(restored.selections.find(row=>row.id===feat)).toBeDefined();expect(restored.notes).toBe(baseline.notes);expect(restored.abilities).toEqual(baseline.abilities);
 return {baseline,down,restored};
}
it('retains parent, two nested children and manual-child pins through the complete edit pipeline',()=>{
 const initial=validateCharacter(structuredClone(fixture.character)),entries=structuredClone(fixture.entries) as Entry[];
 const grand=initial.selections.find(row=>row.parentId===fixture.ids.child)!;
 assertPinsAfterCycle(initial,entries,[fixture.ids.feature,fixture.ids.feat,fixture.ids.child,grand.id,'authored-manual-child'],fixture.ids.resource,fixture.ids.feat,2);
});
const realDirectory=process.env.DND_CLASS_CHOICE_EDIT_PRE_DEDUP_DATA;
it.skipIf(!realDirectory).each(['paladin','ranger'] as const)('retains actual old %s source-parent and child pins through edit 2 → 1 → 2 without refilling resources',name=>{
 const old=JSON.parse(readFileSync(`${realDirectory}/${name}.json`,'utf8'));expect(old.producerCommit).toBe('1a1717f84d9774f34194b9e57a45c247980cfba2');expect(old.level).toBe(2);
 assertPinsAfterCycle(validateCharacter(structuredClone(old.character)),old.entries,[old.ids.feature,old.ids.feat,old.ids.child],old.ids.resource,old.ids.feat,2);
});
it('cleans parked subtree pins after explicitly deleting its class, and prunes an unrelated stale pin',()=>{
 const initial=validateCharacter(structuredClone(fixture.character)),entries=structuredClone(fixture.entries) as Entry[];initial.quickbar!.push(fixture.ids.feature,'authored-stale-pin');
 const down=editLikeApp(initial,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=1;});expect(down.classChoiceArchive).toBeDefined();expect(down.quickbar).not.toContain('authored-stale-pin');
 const deleted=editLikeApp(down,entries,draft=>removeSelection(draft,'class-owner'));
 expect(deleted.classChoiceArchive).toBeUndefined();expect(deleted.quickbar).toEqual([]);expect(deleted.selections).toEqual([]);expect(quickbarEntries(deleted)).toEqual([]);
});
it('deletes only an explicitly removed parked manual child and its pin, retaining the rest of the grant tree',()=>{
 const initial=validateCharacter(structuredClone(fixture.character)),entries=structuredClone(fixture.entries) as Entry[];
 const down=editLikeApp(initial,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=1;});
 const edited=editLikeApp(down,entries,draft=>removeSelection(draft,'authored-manual-child'));
 expect(edited.classChoiceArchive![fixture.ids.feat].selections.some(row=>row.id==='authored-manual-child')).toBe(false);expect(edited.quickbar).not.toContain('authored-manual-child');
 const up=editLikeApp(edited,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=2;});
 expect(up.selections.some(row=>row.id==='authored-manual-child')).toBe(false);expect(up.selections.some(row=>row.id===fixture.ids.feat)).toBe(true);expect(up.quickbar).toContain(fixture.ids.child);expect(up.runtime.resources[fixture.ids.resource].current).toBe(1);
});
it('does not re-pin an explicitly unpinned inactive grant when its class level is restored',()=>{
 const initial=validateCharacter(structuredClone(fixture.character)),entries=structuredClone(fixture.entries) as Entry[];
 const down=editLikeApp(initial,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=1;});
 const unpinned=editLikeApp(down,entries,draft=>removePin(draft,fixture.ids.feat));
 const up=editLikeApp(unpinned,entries,draft=>{draft.selections.find(row=>row.id==='class-owner')!.level=2;});
 expect(up.selections.some(row=>row.id===fixture.ids.feat)).toBe(true);expect(up.quickbar).not.toContain(fixture.ids.feat);expect(up.quickbar).toContain(fixture.ids.child);expect(up.runtime.resources[fixture.ids.resource].current).toBe(1);
});
