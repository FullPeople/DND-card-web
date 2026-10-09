import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';

function setup(sourceData:Record<string,unknown>,level:number){
 const entries=normalizeData(sourceData,'progression-filter-overlap');
 const c=newCharacter();c.automation=newAutomationState();c.notes='手工记录保留';c.runtime.hp=3;c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class'&&entry.source==='XPHB')!,level,quantity:1,equipped:false}];
 syncFeatures(c,entries);return {c,entries};
}
const data={class:[{name:'原创授予职业',ENG_name:'Authored Grant Class',source:'XPHB',classFeatures:['原创风格授予|原创授予职业|XPHB|1'],featProgression:[{name:'原创风格授予',category:['FS'],progression:{'1':1}}]}],classFeature:[{name:'原创风格授予',source:'XPHB',className:'原创授予职业',classSource:'XPHB',level:1,entries:['获得一项{@filter 原创风格|feats|category=FS}。']}],feat:[{name:'原创风格甲',source:'XPHB',category:'FS',entries:[]},{name:'原创风格乙',source:'XPHB',category:'FS',entries:[]}]};

it('offers one grant when a declared class progression and its exact owned feature filter describe the same grant',()=>{
 const {c,entries}=setup(data,1),before={notes:c.notes,runtime:JSON.stringify(c.runtime),abilities:JSON.stringify(c.abilities)},choices=sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat');
 expect(choices).toHaveLength(1);expect(choices[0].count).toBe(1);
 setSheetChoiceSlot(c,choices[0].id,0,choices[0].options[0].value,entries);syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);
 expect(syncFeatures(c,entries)).toBe(false);expect(sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat')).toHaveLength(1);
 expect(c.notes).toBe(before.notes);expect(JSON.stringify(c.runtime)).toBe(before.runtime);expect(JSON.stringify(c.abilities)).toBe(before.abilities);
});
it('retains historical filter answers as the same single grant without rewriting the saved answer records',()=>{
 const {c,entries}=setup(data,1),feature=c.selections.find(row=>row.entry.kind==='feature')!,oldId=`${feature.id}:filter:0`,feat=entries.find(entry=>entry.kind==='feat')!;
 c.answers[oldId]=[feat.id];const answers=JSON.stringify(c.answers),choices=sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat');
 expect(choices).toHaveLength(1);expect(choices[0].selected).toEqual([feat.id]);syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);for(const [id,answer] of Object.entries(JSON.parse(answers)))expect(c.answers[id]).toEqual(answer);expect(c.answers[choices[0].id]).toEqual([feat.id]);
});
it('keeps the class grant identity stable when source features hydrate after the initial pick',()=>{
 const entries=normalizeData(data,'late-class-feature'),c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:1,quantity:1,equipped:false}];
 const original=sheetChoices(c,entries).find(choice=>choice.sourceProgression==='feat')!;
 setSheetChoiceSlot(c,original.id,0,original.options[0].value,entries);syncChoiceContent(c,entries);const answers=JSON.stringify(c.answers);
 syncFeatures(c,entries);const choices=sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat');expect(choices).toHaveLength(1);expect(choices[0].id).toBe(original.id);expect(choices[0].complete).toBe(true);expect(JSON.stringify(c.answers)).toBe(answers);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);
});
it('retains conflicting historical filter picks as overflow records instead of granting twice',()=>{
 const authored={...data,classFeature:[{...data.classFeature[0],entries:[...data.classFeature[0].entries,'获得职业等级后可选择另一个{@filter 原创风格|feats|category=FS}。']}]}, {c,entries}=setup(authored,1),feature=c.selections.find(row=>row.entry.kind==='feature')!,feats=entries.filter(entry=>entry.kind==='feat');
 c.answers[`${feature.id}:filter:0`]=[feats[0].id];c.answers[`${feature.id}:filter:1`]=[feats[1].id];const answers=JSON.stringify(c.answers),choices=sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat');
 expect(choices).toHaveLength(1);expect(choices[0].count).toBe(1);expect(choices[0].slots).toEqual(feats.map(entry=>entry.id));expect(choices[0].selected).toEqual([feats[0].id]);syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(1);for(const [id,answer] of Object.entries(JSON.parse(answers)))expect(c.answers[id]).toEqual(answer);expect(c.answers[choices[0].id]).toEqual(feats.map(entry=>entry.id));
 setSheetChoiceSlot(c,choices[0].id,0,undefined,entries);syncChoiceContent(c,entries);expect(c.selections.filter(row=>row.entry.kind==='feat')).toHaveLength(0);expect(c.answers[`${feature.id}:filter:0`]).toEqual([feats[0].id]);expect(c.answers[`${feature.id}:filter:1`]).toEqual([feats[1].id]);
});
it('preserves independent same-category rewards from another owner or another declared feature',()=>{
 const additional={name:'原创独立授予',source:'XPHB',className:'原创授予职业',classSource:'XPHB',level:1,entries:['获得一项{@filter 原创独立风格|feats|category=FS}。']};
 const {c,entries}=setup({...data,class:[{...data.class[0],classFeatures:[...data.class[0].classFeatures,'原创独立授予|原创授予职业|XPHB|1']}],classFeature:[...data.classFeature,additional],background:[{name:'原创独立背景',source:'XPHB',entries:['获得一项{@filter 原创背景风格|feats|category=FS}。']}]},1);
 c.selections.push({id:'background',entry:entries.find(entry=>entry.kind==='background')!,level:1,quantity:1,equipped:false});
 expect(sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat')).toHaveLength(3);
});

const core=process.env.DND_AUTOMATION_CORE_DATA;
it.skipIf(!core).each([['fighter',1,'FS'],['fighter',19,'EB'],['paladin',2,'FS'],['ranger',2,'FS'],['warlock',19,'EB']] as const)('uses the actual stored %s source at level %s without duplicating its %s class grant', (name,level,category)=>{
 const sourceData=JSON.parse(readFileSync(join(core!,`data_class_class-${name}.json`),'utf8'));
 const {c,entries}=setup(sourceData,level),owner=c.selections[0],groups=owner.entry.raw.featProgression as Array<{category:string[];progression:Record<string,number>}>;
 expect(groups.some(group=>group.category.includes(category)&&group.progression[String(level)]===1)).toBe(true);
 const ownFeatures=c.selections.filter(row=>row.parentId===owner.id&&row.entry.kind==='feature'&&row.entry.raw.level===level);
 expect(ownFeatures.some(row=>row.entry.entries.some(node=>typeof node==='string'&&node.includes(`feats|category=${category}`)))).toBe(true);
 const testFeat:Entry={id:`authored-${category}`,kind:'feat',name:'原创对应专长',english:'Authored Matching Feat',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{category}};
 entries.push(testFeat);
 const corresponding=sheetChoices(c,entries).filter(choice=>choice.catalogKind==='feat'&&choice.options.some(option=>option.value===testFeat.id));
 // Level 19's EB permits other eligible feats, including an FS test feat; this
 // fixture tests the EB category at 19, so only its own grant can contain it.
 expect(corresponding).toHaveLength(1);setSheetChoiceSlot(c,corresponding[0].id,0,testFeat.id,entries);syncChoiceContent(c,entries);
 expect(c.selections.filter(row=>row.entry.id===testFeat.id)).toHaveLength(1);
});
