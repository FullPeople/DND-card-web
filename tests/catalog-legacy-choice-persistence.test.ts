import {expect,it} from 'vitest';
import fixture from './fixtures/preDedupClassChoice.json' with {type:'json'};
import {normalizeData} from '../src/data/catalog';
import {validateCharacter} from '../src/core/validation';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {sheetChoices,syncChoiceContent} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import type {Entry} from '../src/core/model';

// Extend the existing original legacy fixture, never a player's saved card.
function setup(){
 const character=validateCharacter(structuredClone(fixture.character));
 const entries=structuredClone(fixture.entries) as Entry[];
 const original=entries.find(entry=>entry.id===character.selections.find(row=>row.id===fixture.ids.feat)!.entry.id)!;
 const alternate={...structuredClone(original.raw),name:'另一份原创风格定义',ENG_name:original.english};
 const definitions=normalizeData({feat:[alternate,structuredClone(original.raw)]},original.revision,original.packId)
  .map(entry=>({...entry,effects:entry.name===original.name?structuredClone(original.effects):[{op:'add' as const,target:'ac' as const,value:4}]}));
 return {character,original,legacy:entries,current:[...entries.filter(entry=>entry.id!==original.id),...definitions]};
}
function state(character:ReturnType<typeof validateCharacter>){
 return {selections:character.selections.map(row=>({id:row.id,parentId:row.parentId,grantKey:row.grantKey,entryId:row.entry.id,name:row.entry.name})),
  answers:structuredClone(character.answers),resources:structuredClone(character.runtime.resources),quickbar:structuredClone(character.quickbar),
  layout:structuredClone(character.featureLayout),quickbarLayout:structuredClone(character.quickbarLayout),ac:evaluate(character).ac};
}

it.each([true,false])('refreshing a conflicting catalog preserves the old selected definition and consumed grant tree (snapshot cache %s)',keepSnapshots=>{
 const {character,legacy,current,original}=setup();
 syncFeatures(character,legacy);syncAutoResources(character);const before=state(character);
 if(!keepSnapshots)delete character.classChoiceSnapshots;
 syncFeatures(character,current);syncAutoResources(character);
 expect(character.selections.find(row=>row.id===fixture.ids.feat)?.entry.name).toBe(original.name);
 expect(state(character)).toEqual(before);
 expect(syncChoiceContent(character,current)).toBe(false);
});

it.each([true,false])('save/reopen with the expanded catalog keeps the old answer and resource consumption (snapshot cache %s)',keepSnapshots=>{
 const {character,legacy,current,original}=setup();
 syncFeatures(character,legacy);syncAutoResources(character);const before=state(character);
 if(!keepSnapshots)delete character.classChoiceSnapshots;
 const reopened=validateCharacter(JSON.parse(JSON.stringify(character)));
 syncFeatures(reopened,current);syncAutoResources(reopened);
 expect(state(reopened)).toEqual(before);
 const choice=sheetChoices(reopened,current).find(row=>row.sourceProgression==='feat');
 expect(choice?.complete).toBe(true);
 expect(choice?.selected).toContain(original.id);
 expect(reopened.runtime.resources[fixture.ids.resource].current).toBe(1);
});
