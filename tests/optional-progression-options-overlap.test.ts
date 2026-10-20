import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Entry,type Selection} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {validateCharacter} from '../src/core/validation';
import {syncAutoResources} from '../src/core/resources';

// Original prose and candidates; only reviewed source identities are metadata.
const optionalfeature=Array.from({length:28},(_,i)=>({name:`原创学习项 ${i}`,source:'XPHB',featureType:['EI'],entries:['原创手工效果。']}));
const data={class:[{name:'魔契师',ENG_name:'Warlock',source:'XPHB',classFeatures:['原创目录|魔契师|XPHB|1'],optionalfeatureProgression:[{name:'原创学习',featureType:['EI'],progression:[1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10]}]}],classFeature:[{name:'原创目录',ENG_name:'Eldritch Invocation Options',source:'XPHB',className:'魔契师',classSource:'XPHB',level:1,entries:['原创目录说明。',{type:'options',count:1,entries:optionalfeature.map(row=>({type:'refOptionalfeature',optionalfeature:`${row.name}|XPHB`,preserve:{prerequisite:true}}))}]}],optionalfeature};
function setup(input:Record<string,any>=data,at=1){
 const entries=normalizeData(input,'authored-optional-overlap'),c=newCharacter();c.automation=newAutomationState();c.notes='原创旧卡手工备注';c.runtime.hp=3;c.runtime.resources.authored={name:'原创已消耗资源',max:3,current:0};
 c.selections=[{id:'owner',entry:entries.find(row=>row.kind==='class')!,level:at,quantity:1,equipped:false}];syncFeatures(c,entries);
 const feature=c.selections.find(row=>row.entry.raw._category==='classFeature')!,oldId=`${feature.id}:text-option:entries:1`;
 return {c,entries,feature,oldId,items:entries.filter(row=>row.raw._category==='optionalfeature'),choice:()=>sheetChoices(c,entries).find(row=>row.id==='owner:class-optional:0')!};
}

it('uses one reviewed learning quota at levels 1, 3 and 1, with overflow and saved data preserved',()=>{
 const {c,entries,items,choice}=setup(),before=structuredClone({runtime:c.runtime,abilities:c.abilities,notes:c.notes});
 expect(sheetChoices(c,entries).filter(row=>row.channel==='content')).toHaveLength(1);
 expect(choice().count).toBe(1);setSheetChoiceSlot(c,choice().id,0,items[0].id,entries);
 c.selections[0].level=3;syncFeatures(c,entries);expect(choice().count).toBe(3);setSheetChoiceSlot(c,choice().id,2,items[1].id,entries);
 const saved=structuredClone(c.answers);c.selections[0].level=1;syncFeatures(c,entries);expect(choice().slots![2]).toBe(items[1].id);expect(c.answers).toEqual(saved);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));syncFeatures(reopened,[]);expect(sheetChoices(reopened,[]).filter(row=>row.channel==='content')).toHaveLength(1);
 expect(reopened.answers).toEqual(saved);expect(reopened.runtime).toEqual(before.runtime);expect(reopened.abilities).toEqual(before.abilities);expect(reopened.notes).toBe(before.notes);
 expect(c.selections.filter(row=>row.entry.raw._category==='optionalfeature')).toHaveLength(0);
});

it('imports both historical answers once, retains their raw records, and does not resurrect a cancelled pick',()=>{
 const {c,entries,items,choice,oldId}=setup(undefined,3);c.answers[choice().id]=[items[0].id];c.answers[oldId]=[items[1].id];
 expect(choice().slots!.filter(Boolean)).toEqual([items[0].id,items[1].id]);syncChoiceContent(c,entries);
 expect(c.answers[oldId]).toEqual([items[1].id]);expect(choice().selected).toEqual([items[0].id,items[1].id]);
 setSheetChoiceSlot(c,choice().id,1,undefined,entries);syncFeatures(c,entries);expect(choice().selected).toEqual([items[0].id]);expect(c.answers[oldId]).toEqual([items[1].id]);
 // A later edit by the old reader is a new legacy record, not the cancelled one.
 c.answers[oldId]=[items[2].id];syncFeatures(c,entries);expect(choice().selected).toEqual([items[0].id,items[2].id]);
 const before=JSON.stringify(c);expect(syncFeatures(c,entries)).toBe(false);expect(JSON.stringify(c)).toBe(before);
});

it.each(['slot-replace','slot-remove','concept-remove'] as const)('honors the first explicit %s edit of an old-only answer before hydration',mode=>{
 const {c,entries,items,choice,oldId}=setup();c.answers[oldId]=[items[0].id];
 if(mode==='concept-remove')chooseSheetOption(c,choice().id,items[0].id,entries);
 else setSheetChoiceSlot(c,choice().id,0,mode==='slot-replace'?items[1].id:undefined,entries);
 const expected=mode==='slot-replace'?[items[1].id]:[];
 expect(choice().selected).toEqual(expected);syncFeatures(c,entries);expect(choice().selected).toEqual(expected);expect(c.answers[oldId]).toEqual([items[0].id]);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));syncFeatures(reopened,[]);expect(sheetChoices(reopened,[]).find(row=>row.id===choice().id)!.selected).toEqual(expected);
});

it('retains the original granted tree, IDs, references and consumed resources rather than granting it again',()=>{
 const {c,entries,feature,items,choice,oldId}=setup();c.answers[oldId]=[items[0].id];
 const old={id:'legacy-grant',entry:structuredClone(items[0]),level:1,quantity:1,equipped:false,parentId:feature.id,requirementId:oldId,grantKey:`choice:${oldId}:${items[0].id}`};
 const child:Selection={...structuredClone(old),id:'manual-child',parentId:old.id,entry:{...structuredClone(items[1]),id:'authored-manual-child-entry',name:'原创手工子项'},requirementId:undefined,grantKey:undefined};
 c.selections.push(old,child);c.quickbar=[old.id,child.id];c.featureLayout={order:[old.id,child.id],expanded:[old.id]};
 const retained=structuredClone({old,child,runtime:c.runtime,quickbar:c.quickbar,layout:c.featureLayout});syncFeatures(c,entries);
 expect(c.selections.find(row=>row.id===old.id)).toEqual(retained.old);expect(c.selections.find(row=>row.id===child.id)).toEqual(retained.child);
 expect(c.runtime).toEqual(retained.runtime);expect(c.quickbar).toEqual(retained.quickbar);expect(c.featureLayout).toEqual(retained.layout);expect(choice().selected).toEqual([items[0].id]);expect(choice().hint).toContain('旧入口');
 setSheetChoiceSlot(c,choice().id,0,items[1].id,entries);syncFeatures(c,entries);expect(c.selections.find(row=>row.id===old.id)).toEqual(retained.old);expect(c.selections.filter(row=>row.entry.id===items[1].id)).toHaveLength(0);
 c.profile.enabledSources=[];syncFeatures(c,entries);expect(choice().restricted).toBe(true);expect(choice().selected).toEqual([]);expect(c.runtime).toEqual(retained.runtime);
 c.profile.enabledSources=['XPHB'];const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));syncFeatures(reopened,[]);expect(reopened.selections.find(row=>row.id===old.id)).toEqual(retained.old);expect(reopened.runtime).toEqual(retained.runtime);
});

it.each(['unreviewed-feature','changed-count','missing-reference','mixed-category','wrong-edition','changed-progression','independent-owner'] as const)('preserves the independent or unverified %s choice',mode=>{
 const input=structuredClone(data);
 if(mode==='unreviewed-feature')input.classFeature[0].ENG_name='Authored Independent Grant';
 if(mode==='changed-count')(input.classFeature[0].entries[1] as any).count=2;
 if(mode==='missing-reference')(input.classFeature[0].entries[1] as any).entries.pop();
 if(mode==='mixed-category')input.optionalfeature[0].featureType=['MM'];
 if(mode==='changed-progression')input.class[0].optionalfeatureProgression[0].progression[2]=4;
 const {c,entries,feature}=setup(input,3);
 if(mode==='wrong-edition')feature.entry.edition='2014';
 if(mode==='independent-owner'){delete feature.parentId;delete feature.grantKey;}
 expect(sheetChoices(c,entries).filter(row=>row.channel==='content')).toHaveLength(2);
});

const core=process.env.DND_AUTOMATION_CORE_DATA;
const oldFixture=process.env.DND_OPTIONAL_OPTIONS_LEGACY_FIXTURE;
it.skipIf(!oldFixture)('preserves a pre-fix-code-produced tree and spent feature counter across refresh, restriction, import and level changes',()=>{
 const fixture=JSON.parse(readFileSync(oldFixture!,'utf8'));expect(fixture.producer).toBe('c08f11af030035a14c117c2219aae946281e4f13');
 const c=validateCharacter(fixture.character),entries=fixture.entries as Entry[],{ids}=fixture;
 const old=structuredClone(c.selections.find(row=>row.id===ids.granted))!,resource=structuredClone(c.runtime.resources[ids.resource]),answers=structuredClone(c.answers),layout=structuredClone(c.featureLayout),quickbar=structuredClone(c.quickbar);
 expect(resource.current).toBe(0);syncFeatures(c,entries);syncAutoResources(c);
 const choice=()=>sheetChoices(c,entries).find(row=>row.id===ids.canonical)!;
 expect(choice().selected).toHaveLength(2);expect(c.selections.find(row=>row.id===ids.granted)).toEqual(old);expect(c.runtime.resources[ids.resource]).toEqual(resource);
 for(const [id,value] of Object.entries(answers)){if(id===ids.canonical){for(const [index,pick] of (value as string[]).entries())if(pick)expect(c.answers[id][index]).toBe(pick);}else expect(c.answers[id]).toEqual(value);}
 c.selections[0].level=1;syncFeatures(c,entries);syncAutoResources(c);expect(choice().slots!.filter(Boolean)).toHaveLength(2);expect(c.runtime.resources[ids.resource].current).toBe(0);
 c.profile.enabledSources=[];syncFeatures(c,entries);syncAutoResources(c);expect(choice().selected).toEqual([]);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));reopened.profile.enabledSources=['XPHB'];reopened.selections[0].level=3;syncFeatures(reopened,[]);syncAutoResources(reopened);
 expect(reopened.selections.find(row=>row.id===ids.granted)).toEqual(old);expect(reopened.runtime.resources[ids.resource]).toEqual(resource);
 expect(reopened.featureLayout).toEqual(layout);expect(reopened.quickbar).toEqual(quickbar);expect(reopened.notes).toBe(c.notes);expect(reopened.abilities).toEqual(c.abilities);
 expect(sheetChoices(reopened,[]).find(row=>row.id===ids.canonical)!.selected).toHaveLength(2);
});
it.skipIf(!core)('links the actual frozen 2024 source options while preserving the independent 2014 identity',()=>{
 const classBody=JSON.parse(readFileSync(join(core!,'data_class_class-warlock.json'),'utf8')),options=JSON.parse(readFileSync(join(core!,'data_optionalfeatures.json'),'utf8'));
 const {c,entries,choice}=setup({...classBody,...options},3);
 const actualOwner=entries.find(row=>row.kind==='class'&&row.source==='XPHB')!;c.selections=[{...c.selections[0],entry:actualOwner}];syncFeatures(c,entries);
 expect(choice().count).toBe(3);expect(choice().duplicateChoiceIds).toHaveLength(1);expect(choice().options.filter(option=>option.entry.source==='XPHB')).toHaveLength(28);
 expect(sheetChoices(c,entries).some(row=>row.id===choice().duplicateChoiceIds![0])).toBe(false);
 const legacy:Entry=entries.find(row=>row.kind==='class'&&row.source==='PHB')!;c.selections=[{...c.selections[0],entry:legacy}];c.edition='2014';c.profile.enabledSources=['PHB'];syncFeatures(c,entries);
 expect(choice().count).toBe(2);expect(choice().duplicateChoiceIds).toEqual([]);
});
