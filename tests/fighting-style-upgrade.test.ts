import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {it,expect} from 'vitest';
import {type Character,type Entry} from '../src/core/model';
import {validateCharacter} from '../src/core/validation';
import {initializeAutomation} from '../src/core/automation/state';
import {hydrateImportedCasting} from '../src/core/castingSnapshot';
import {rememberSourceSpellUses} from '../src/core/automation/sourceSpellState';
import {reconcileEquipping} from '../src/core/automation/equipment';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {syncAutoResources} from '../src/core/resources';
import {ensureResourceWidget} from '../src/core/resourceWidgets';
import {pruneQuickbar} from '../src/core/quickbar';
import {evaluate} from '../src/core/engine';

// Full synchronous App edit order on disposable, actual old-code-generated cards.
function edit(before:Character,entries:Entry[],action:(c:Character)=>void=()=>{}){
 const c=structuredClone(before),defaults=initializeAutomation(c);hydrateImportedCasting(c,entries);
 if(defaults){syncFeatures(c,entries);syncAutoResources(c,before);}
 rememberSourceSpellUses(c);action(c);reconcileEquipping(before,c);syncFeatures(c,entries);syncSourceSpells(c,entries);syncAutoResources(c,before);
 for(const id of Object.keys(c.runtime.resources))if(!Object.hasOwn(before.runtime.resources,id))ensureResourceWidget(c,id);pruneQuickbar(c);return validateCharacter(c);
}
const directory=process.env.DND_FIGHTING_STYLE_UPGRADE_FIXTURES;
type OldFixture={producerCommit:string;level:number;character:Character;entries:Entry[];armorAc:number;defenseAc:number;ids:{feature:string;choice:string;feat:string;featEntry:string;resource:string;manual:string;nested:string}};
function load(name:string){const data=JSON.parse(readFileSync(join(directory!,name+'.json'),'utf8')) as OldFixture;expect(data.producerCommit).toBe('1a1717f84d9774f34194b9e57a45c247980cfba2');const c=validateCharacter(data.character);expect(c.selections.find(s=>s.id===data.ids.feat)!.entry.raw.prerequisite).toEqual([{feature:['战斗风格']}]);return {...data,c};}
function preserved(old:ReturnType<typeof load>,c:Character){
 const original=old.c.selections.find(s=>s.id===old.ids.feat)!;const grant=c.selections.find(s=>s.id===old.ids.feat);expect(grant,'actual existing FS grant must remain active after upgrade').toBeDefined();
 expect(grant).toMatchObject({id:original.id,parentId:original.parentId,grantKey:original.grantKey});
 for(const id of [old.ids.manual,old.ids.nested])expect(c.selections.find(s=>s.id===id)).toEqual(old.c.selections.find(s=>s.id===id));
 expect(c.selections.filter(s=>s.entry.id===old.ids.featEntry)).toHaveLength(1);expect(c.classChoiceArchive?.[old.ids.feat]).toBeUndefined();expect(evaluate(c).ac).toBe(old.defenseAc);
 for(const [key,value] of Object.entries(old.c.answers))expect(c.answers[key]).toEqual(value);
 expect(c.runtime.resources[old.ids.resource]).toEqual(old.c.runtime.resources[old.ids.resource]);expect(c.runtime.resources[old.ids.resource].current).toBe(1);
 expect(c.quickbar).toEqual(old.c.quickbar);expect(c.featureLayout).toEqual(old.c.featureLayout);expect(c.quickbarLayout?.order).toEqual(old.c.quickbarLayout?.order);expect(c.quickbarLayout?.hidden).toEqual(old.c.quickbarLayout?.hidden);expect(c.quickbarLayout?.attacks).toEqual(old.c.quickbarLayout?.attacks);for(const [id,layout] of Object.entries(old.c.quickbarLayout?.widgets||{}))expect(c.quickbarLayout?.widgets?.[id]).toEqual(layout);expect(c.notes).toBe(old.c.notes);expect(c.abilities).toEqual(old.c.abilities);expect(c.runtime.hp).toBe(3);
 const choice=sheetChoices(c,old.entries).find(q=>q.sourceProgression==='feat'&&q.duplicateChoiceIds?.includes(old.ids.choice))!;expect(choice).toBeDefined();expect(choice.selected).toContain(old.ids.featEntry);expect(choice.complete).toBe(true);
}
it.skipIf(!directory).each(['fighter','paladin','ranger'])('preserves an actual old %s Defense grant and nested manual data through upgrade, repeat open and import',name=>{
 const old=load(name);expect(old.defenseAc).toBe(old.armorAc+1);const upgraded=edit(old.c,old.entries);preserved(old,upgraded);expect(upgraded.quickbarLayout).toEqual(old.c.quickbarLayout);
 const repeated=edit(validateCharacter(JSON.parse(JSON.stringify(upgraded))),old.entries);preserved(old,repeated);expect(repeated).toEqual(upgraded);
 const higher=edit(repeated,old.entries,c=>{c.selections.find(s=>s.id==='class-owner')!.level=old.level+1;});preserved(old,higher);
});
it.skipIf(!directory).each(['fighter','paladin','ranger'])('retains an actual %s FS grant, consumed manual resource and pins through source-off/on and offline import',name=>{
 const old=load(name),upgraded=edit(old.c,old.entries),sources=[...upgraded.profile.enabledSources];preserved(old,upgraded);
 const off=edit(upgraded,old.entries,c=>{c.profile.enabledSources=[];});expect(off.selections.some(s=>s.id===old.ids.feat)).toBe(false);expect(off.classChoiceArchive![old.ids.feat].selections.some(s=>s.id===old.ids.nested)).toBe(true);expect(off.quickbar).toEqual(old.c.quickbar);
 const on=edit(validateCharacter(JSON.parse(JSON.stringify(off))),[],c=>{c.profile.enabledSources=sources;});preserved(old,on);
});
it.skipIf(!directory).each(['paladin','ranger'])('restores the exact real %s grant after legal level 2→1→2 without refilling resources',name=>{
 const old=load(name),upgraded=edit(old.c,old.entries);preserved(old,upgraded);
 const down=edit(upgraded,old.entries,c=>{c.selections.find(s=>s.id==='class-owner')!.level=1;});expect(down.selections.some(s=>s.id===old.ids.feat)).toBe(false);expect(down.runtime.resources[old.ids.resource]).toBeUndefined();expect(down.quickbar).toEqual(old.c.quickbar);
 const restored=edit(validateCharacter(JSON.parse(JSON.stringify(down))),old.entries,c=>{c.selections.find(s=>s.id==='class-owner')!.level=2;});preserved(old,restored);
});
it.skipIf(!directory).each(['fighter','paladin','ranger'])('keeps a new unknown %s feat prerequisite blocked and rejects its edit without mutation',name=>{
 const old=load(name),c=edit(old.c,old.entries),unknown:Entry={...structuredClone(old.entries.find(e=>e.id===old.ids.featEntry)!),id:'authored-unknown-fs',name:'原创未知FS',english:'Authored Unknown FS',raw:{_category:'feat',category:'FS',prerequisite:[{feature:['未核对特性']}]}};
 const entries=[...old.entries,unknown],choice=sheetChoices(c,entries).find(q=>q.sourceProgression==='feat'&&q.duplicateChoiceIds?.includes(old.ids.choice))!;expect(choice.options.find(o=>o.value===unknown.id)!.unavailable).toBeTruthy();const before=JSON.stringify(c);expect(()=>setSheetChoiceSlot(c,choice.id,0,unknown.id,entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it.skipIf(!directory).each([['paladin','Blessed Warrior'],['ranger','Druidic Warrior']])('recognizes only the actual source-qualified %s alternative prerequisite', (name,english)=>{
 const old=load(name),c=edit(old.c,old.entries),special=old.entries.find(e=>e.kind==='feat'&&e.source==='XPHB'&&e.english===english)!;expect(special).toBeDefined();expect(Object.keys(special.raw.prerequisite[0])).toEqual(['otherSummary']);
 const choice=sheetChoices(c,old.entries).find(q=>q.sourceProgression==='feat'&&q.duplicateChoiceIds?.includes(old.ids.choice))!;expect(choice.options.find(o=>o.value===special.id)!.unavailable).toBeUndefined();
 setSheetChoiceSlot(c,choice.id,0,special.id,old.entries);const selected=edit(c,old.entries);expect(sheetChoices(selected,old.entries).find(q=>q.id===choice.id)!.selected).toEqual([special.id]);expect(selected.selections.filter(s=>s.entry.id===special.id)).toHaveLength(1);
 const altered:Entry={...structuredClone(special),raw:{...special.raw,prerequisite:[{otherSummary:{...special.raw.prerequisite[0].otherSummary,entry:special.raw.prerequisite[0].otherSummary.entry+'，还有未知限制'}}]}};
 const changed=old.entries.map(e=>e.id===special.id?altered:e),unselected=edit(old.c,old.entries);expect(sheetChoices(unselected,changed).find(q=>q.id===choice.id)!.options.find(o=>o.value===special.id)!.unavailable).toBeTruthy();
});
it.skipIf(!directory).each(['missing','disabled','dismissed','wrong reference','unrelated manual copy'])('does not satisfy a Fighting Style prerequisite using a %s source feature',mode=>{
 const old=load('fighter'),c=edit(old.c,old.entries),feature=c.selections.find(s=>s.id===old.ids.feature)!;
 if(mode==='missing')c.selections=c.selections.filter(s=>s.id!==feature.id);
 if(mode==='disabled')c.profile.disabledEntries=[feature.entry.id];
 if(mode==='dismissed')c.dismissedFeatures=[`class-owner|${feature.grantKey}`];
 if(mode==='wrong reference')feature.grantKey='ref:unverified-source-reference';
 if(mode==='unrelated manual copy'){delete feature.parentId;delete feature.grantKey;feature.entry={...feature.entry,raw:{...feature.entry.raw,_category:'inlineChoice'}};}
 const choice=sheetChoices(c,old.entries).find(q=>q.sourceProgression==='feat'&&q.ownerId==='class-owner'&&q.options.some(o=>o.value===old.ids.featEntry))!;expect(choice.options.find(o=>o.value===old.ids.featEntry)!.unavailable).toBeTruthy();
});
