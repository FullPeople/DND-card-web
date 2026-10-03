import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter,normalizeFixtureData as normalizeData} from './helpers/irFixture';
import {reviewCoreSamples,readReviewedClass} from './helpers/reviewedCoreSamples';
import {correctSourceData} from '../src/core/sourceCorrections';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {specialSpellResource,changeSpecialSpellUses} from '../src/core/specialSpells';
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {type Entry,type Character} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,chooseSheetOption,claimStartingEquipment,setSheetChoiceSlot,builtinOptionsVisible,setBuiltinOptionsVisible} from '../src/core/automation/choices';
import {performRest,longRestHitDiceBudget} from '../src/core/automation/rest';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {syncAutoResources,setResource} from '../src/core/resources';
import {planFeatureResources,restResources} from '../src/core/automation/featureResources';
import {evaluate} from '../src/core/engine';

import {validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';

export const fixtureEntries:Entry[]=normalizeData({class:[{name:'测试职业',ENG_name:'Fixture Class',source:'XPHB',hd:{faces:10},startingProficiencies:{skills:[{choose:{from:['athletics','perception','history'],count:2}}]},startingEquipment:{defaultData:[{A:[{item:'测试剑|XPHB'},{value:400}],B:[{value:15000}]}]},classFeatures:['测试圣职|测试职业|XPHB|1|XPHB','测试回气|测试职业|XPHB|1|XPHB']}],classFeature:[{name:'测试圣职',source:'XPHB',className:'测试职业',classSource:'XPHB',level:1,entries:[{type:'options',count:1,entries:[{type:'entries',name:'保护者',entries:['原创选项：防护。'],effects:[{op:'add',target:'ac',value:2}]},{type:'entries',name:'奇术使',entries:['原创选项：魔法。']}]}]},{name:'测试回气',source:'XPHB',className:'测试职业',classSource:'XPHB',level:1,resources:[{name:'回气',max:'@class.level + 1',formula:'1d10 + @class.level',recovery:{short:1,long:'all'}}],entries:['原创资源验收条目。']}],item:[{name:'测试剑',source:'XPHB',entries:['原创测试装备。']}]},'fixture');
export function fixtureCharacter(){const c=newCharacter();c.name='选择与资源验收';c.automation=newAutomationState();c.selections=[{id:'class-owner',entry:fixtureEntries.find(e=>e.kind==='class')!,level:1,quantity:1,equipped:false}];syncFeatures(c,fixtureEntries);syncAutoResources(c);return c;}
it('slot edits preserve empty positions, swap duplicates, replace full choices and validate before mutation',()=>{
 const c=fixtureCharacter(),r=sheetChoices(c,fixtureEntries)[0];setSheetChoiceSlot(c,r.id,1,'athletics',fixtureEntries);expect(sheetChoices(c,fixtureEntries)[0].slots).toEqual(['','athletics']);setSheetChoiceSlot(c,r.id,0,'history',fixtureEntries);setSheetChoiceSlot(c,r.id,0,'athletics',fixtureEntries);expect(sheetChoices(c,fixtureEntries)[0].slots).toEqual(['athletics','history']);setSheetChoiceSlot(c,r.id,1,'perception',fixtureEntries);expect(evaluate(c).skills.history.proficient).toBe(false);expect(evaluate(c).skills.perception.proficient).toBe(true);
 const before=JSON.stringify(c);expect(()=>setSheetChoiceSlot(c,r.id,0,'arcana',fixtureEntries)).toThrow();expect(()=>setSheetChoiceSlot(c,r.id,2,'history',fixtureEntries)).toThrow();expect(JSON.stringify(c)).toBe(before);setSheetChoiceSlot(c,r.id,0,undefined,fixtureEntries);expect(validateCharacter(exportCharacter(c)).answers[r.id]).toEqual(['','perception']);
});
it('repeated slot assignments are no-ops and ordinary choices preserve unrelated source and runtime objects',()=>{
 const c=fixtureCharacter(),r=sheetChoices(c,fixtureEntries).find(row=>row.channel==='skills')!,selections=c.selections,runtime=c.runtime;
 setSheetChoiceSlot(c,r.id,0,'athletics',fixtureEntries);expect(c.selections).toBe(selections);expect(c.runtime).toBe(runtime);
 const answers=c.answers,layout=c.featureLayout,before=JSON.stringify(c);for(let i=0;i<20;i++)setSheetChoiceSlot(c,r.id,0,'athletics',fixtureEntries);
 expect(c.answers).toBe(answers);expect(c.featureLayout).toBe(layout);expect(JSON.stringify(c)).toBe(before);
 expect(()=>setSheetChoiceSlot(c,r.id,3,'athletics',fixtureEntries)).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('custom non-skill choices remain content choices and quota growth reveals new pending options',()=>{
 const c=fixtureCharacter(),owner=c.selections[0];owner.entry=structuredClone(owner.entry);owner.entry.choices=[{id:'macro',label:'宏选择',count:1,options:['custom-action','custom-dice'],optionLabels:{'custom-action':'动作宏','custom-dice':'骰子宏'}}];Object.assign(owner.entry,irFixture(owner.entry));const custom=sheetChoices(c,fixtureEntries).find(r=>r.label==='宏选择')!;expect(custom.channel).toBe('content');chooseSheetOption(c,custom.id,'custom-action',fixtureEntries);expect(c.answers[custom.id]).toEqual(['custom-action']);
 const rows=sheetChoices(c,fixtureEntries),skill=rows.find(r=>r.channel==='skills')!,equip=rows.find(r=>r.channel==='equipment')!,content=rows.find(r=>r.label==='测试圣职')!;chooseSheetOption(c,skill.id,'athletics',fixtureEntries);chooseSheetOption(c,skill.id,'history',fixtureEntries);claimStartingEquipment(c,equip.id,'A',fixtureEntries);chooseSheetOption(c,content.id,content.options[0].value,fixtureEntries);expect(builtinOptionsVisible(c,owner.id,sheetChoices(c,fixtureEntries))).toBe(false);
 owner.entry.raw.startingProficiencies.skills[0].choose.count=3;Object.assign(owner.entry,irFixture(owner.entry));expect(builtinOptionsVisible(c,owner.id,sheetChoices(c,fixtureEntries))).toBe(true);setBuiltinOptionsVisible(c,owner.id,false);expect(builtinOptionsVisible(c,owner.id,sheetChoices(c,fixtureEntries))).toBe(false);removeSelection(c,owner.id);expect(c.featureLayout?.optionsVisible?.[owner.id]).toBeUndefined();
});
it('nested source headings share their root source toggle and pending completion state',()=>{
 const c=fixtureCharacter(),entry=structuredClone(c.selections[0].entry);entry.id='nested-source';entry.kind='subclass';entry.raw={};Object.assign(entry,irFixture(entry));entry.entries=[];entry.choices=[{id:'nested',label:'子职选择',count:1,options:['one','two']}];Object.assign(entry,irFixture(entry));c.selections.push({id:'nested-owner',parentId:'class-owner',entry,quantity:1,level:1,equipped:false});expect(builtinOptionsVisible(c,'nested-owner',sheetChoices(c,fixtureEntries))).toBe(true);setBuiltinOptionsVisible(c,'class-owner',false);expect(builtinOptionsVisible(c,'nested-owner',sheetChoices(c,fixtureEntries))).toBe(false);setBuiltinOptionsVisible(c,'nested-owner',true);expect(c.featureLayout!.optionsVisible).toEqual({'class-owner':true});
});
it('completed buttons wait for descendant choices, disappear together and can be restored without repeating grants',()=>{
 const c=fixtureCharacter(),rows=sheetChoices(c,fixtureEntries),skill=rows[0],equipment=rows[1],content=rows[2];setSheetChoiceSlot(c,skill.id,0,'athletics',fixtureEntries);setSheetChoiceSlot(c,skill.id,1,'history',fixtureEntries);expect(builtinOptionsVisible(c,'class-owner',sheetChoices(c,fixtureEntries))).toBe(true);claimStartingEquipment(c,equipment.id,'A',fixtureEntries);expect(builtinOptionsVisible(c,'class-owner',sheetChoices(c,fixtureEntries))).toBe(true);chooseSheetOption(c,content.id,content.options[1].value,fixtureEntries);syncFeatures(c,fixtureEntries);expect(builtinOptionsVisible(c,'class-owner',sheetChoices(c,fixtureEntries))).toBe(false);expect(c.selections.some(s=>s.grantKey?.startsWith('choice:'))).toBe(true);
 setBuiltinOptionsVisible(c,'class-owner',true);const restored=validateCharacter(exportCharacter(c));expect(builtinOptionsVisible(restored,'class-owner',sheetChoices(restored,fixtureEntries))).toBe(true);for(let i=0;i<3;i++)syncFeatures(restored,fixtureEntries);expect(restored.inventory!.coins.gp).toBe(4);setSheetChoiceSlot(restored,skill.id,1,undefined,fixtureEntries);setSheetChoiceSlot(restored,skill.id,1,'perception',fixtureEntries);expect(builtinOptionsVisible(restored,'class-owner',sheetChoices(restored,fixtureEntries))).toBe(false);
 const invalid=structuredClone(c);invalid.featureLayout!.optionsVisible={'class-owner':'yes' as any};expect(()=>validateCharacter(invalid)).toThrow(/自带选项/);
});
it('choices attach only selected content, reselection retracts effects and preserves manual proficiency overrides',()=>{
 const c=fixtureCharacter();const choices=sheetChoices(c,fixtureEntries);expect(choices.map(r=>[r.label,r.count])).toEqual([['起始熟练项',2],['起始装备',1],['测试圣职',1]]);
 const skill=choices[0];chooseSheetOption(c,skill.id,'athletics',fixtureEntries);chooseSheetOption(c,skill.id,'perception',fixtureEntries);expect(()=>chooseSheetOption(c,skill.id,'history',fixtureEntries)).toThrow();expect(evaluate(c).skills.athletics.proficient).toBe(true);
 const content=choices[2];chooseSheetOption(c,content.id,content.options[0].value,fixtureEntries);syncFeatures(c,fixtureEntries);expect(evaluate(c).ac).toBe(12);
 chooseSheetOption(c,content.id,content.options[1].value,fixtureEntries);syncFeatures(c,fixtureEntries);expect(evaluate(c).ac).toBe(10);expect(c.selections.filter(s=>s.grantKey?.startsWith('choice:'))).toHaveLength(1);
 c.proficiencies={athletics:false};expect(evaluate(c).skills.athletics.proficient).toBe(false);
 c.automation!.enabled=false;expect(sheetChoices(c)).toEqual([]);
});
it('starting equipment is granted once, can be replaced, and import/refresh do not duplicate money or choices',()=>{
 const c=fixtureCharacter(),r=sheetChoices(c,fixtureEntries).find(r=>r.channel==='equipment')!;claimStartingEquipment(c,r.id,'A',fixtureEntries);syncFeatures(c,fixtureEntries);expect(c.inventory!.coins.gp).toBe(4);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);
 for(let i=0;i<10;i++)syncFeatures(c,fixtureEntries);expect(c.inventory!.coins.gp).toBe(4);
 const restored=validateCharacter(exportCharacter(c));expect(restored.backgroundChoices).toEqual(c.backgroundChoices);
 claimStartingEquipment(c,r.id,'B',fixtureEntries);syncFeatures(c,fixtureEntries);expect(c.inventory!.coins.gp).toBe(154);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);removeSelection(c,'class-owner');syncFeatures(c,fixtureEntries);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);expect(c.inventory!.coins.gp).toBe(154);
});
it('grouped equipment claims are atomic and generic prose never corrects declared copper amounts',()=>{
 const c=fixtureCharacter(),owner=c.selections[0];owner.entry=structuredClone(owner.entry);const fixed=irFixture({...fixtureEntries.find(e=>e.kind==='item')!,id:'fixed-equipment',name:'固定装备',english:'Fixed Equipment',raw:{}});owner.entry.raw.startingEquipment.defaultData=[{a:[{item:'测试剑|XPHB'}],b:[{value:500}]},{_:[{item:'固定装备|XPHB'}]}];Object.assign(owner.entry,irFixture(owner.entry,undefined,[owner.entry,...fixtureEntries,fixed]));const r=sheetChoices(c,fixtureEntries).find(r=>r.channel==='equipment')!;
 const before=JSON.stringify(c);expect(()=>claimStartingEquipment(c,r.id,'default',fixtureEntries)).toThrow();expect(JSON.stringify(c)).toBe(before);claimStartingEquipment(c,r.id,'default',[...fixtureEntries,fixed],{'group:0':'a'});expect(c.selections.filter(s=>s.entry.kind==='item').map(s=>s.entry.name)).toEqual(['测试剑','固定装备']);
 owner.entry.raw.startingEquipment={defaultData:[{A:[{value:7000}],B:[{value:11000}]}],entries:['(A) 装备与 7 GP; 或 (B) 110 GP']};Object.assign(owner.entry,irFixture(owner.entry));const corrected=correctSourceData(owner.entry.raw);expect(corrected.startingEquipment.defaultData[0].A[0].value).toBe(7000);expect(owner.entry.raw.startingEquipment.defaultData[0].A[0].value).toBe(7000);expect(correctSourceData(corrected)).toBe(corrected);expect(validateCharacter(exportCharacter(c)).selections[0].entry.raw.startingEquipment.defaultData[0].A[0].value).toBe(7000);
});
it('missing equipment data blocks claims until catalogue arrival and later refresh preserves possessions',()=>{
 const c=fixtureCharacter(),r=sheetChoices(c).find(r=>r.channel==='equipment')!;const before=structuredClone(c);expect(()=>claimStartingEquipment(c,r.id,'A',[])).toThrow(/未发放/);expect(c).toEqual(before);claimStartingEquipment(c,r.id,'A',fixtureEntries);const item=c.selections.find(s=>s.entry.kind==='item')!,id=item.id;expect(item.entry.raw._equipmentRef).toBeUndefined();item.equipped=true;
 syncFeatures(c,fixtureEntries);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(1);expect(c.selections.find(s=>s.id===id)?.entry.raw._equipmentRef).toBeUndefined();expect(c.selections.find(s=>s.id===id)?.equipped).toBe(true);expect(c.selections.find(s=>s.id===id)?.parentId).toBeUndefined();expect(c.inventory!.coins.gp).toBe(4);
});
it('resource lifecycle retains spend, supports partial rest, level changes, player maximum and presentation',()=>{
 const c=fixtureCharacter(),id=Object.keys(c.runtime.resources).find(k=>k.startsWith('feature-resource:'))!;expect(c.runtime.resources[id].max).toBe(2);expect(c.runtime.resources[id].featureGrant?.formula).toBe('1d10 + 1');setResource(c,id,0);
 for(let i=0;i<10;i++){evaluate(c);syncAutoResources(c);}expect(c.runtime.resources[id].current).toBe(0);restResources(c,'short');expect(c.runtime.resources[id].current).toBe(1);restResources(c,'long');expect(c.runtime.resources[id].current).toBe(2);
 setResource(c,id,1);c.selections[0].level=3;syncAutoResources(c);expect([c.runtime.resources[id].max,c.runtime.resources[id].current]).toEqual([4,3]);c.runtime.resources[id].max=7;c.runtime.resources[id].current=5;c.runtime.resources[id].type='bar';c.selections[0].level=4;syncAutoResources(c);expect([c.runtime.resources[id].max,c.runtime.resources[id].current,c.runtime.resources[id].type]).toEqual([7,5,'bar']);
 const feature=c.selections.find(s=>s.entry.name==='测试回气')!;removeSelection(c,feature.id);syncAutoResources(c);expect(c.runtime.resources[id]).toBeUndefined();c.dismissedFeatures=[];syncFeatures(c,fixtureEntries);syncAutoResources(c);expect(c.runtime.resources[id].current).toBe(5);expect(c.runtime.resources[id].max).toBe(7);
 expect(validateCharacter(exportCharacter(c)).runtime.featureResourceArchive).toEqual(c.runtime.featureResourceArchive);
});
it('level down and up preserve spent uses beyond the temporarily smaller maximum',()=>{
 const c=fixtureCharacter();c.selections[0].level=4;syncAutoResources(c);const id=Object.keys(c.runtime.resources).find(k=>k.startsWith('feature-resource:'))!;setResource(c,id,1);
 c.selections[0].level=1;syncAutoResources(c);expect([c.runtime.resources[id].max,c.runtime.resources[id].current]).toEqual([2,0]);
 const restored=validateCharacter(exportCharacter(c));restored.selections[0].level=4;syncAutoResources(restored);expect(restored.runtime.resources[id].current).toBe(1);
});
it('multiclass skills follow each class entry declaration and equipment belongs only to the starting class',()=>{
 const c=fixtureCharacter(),entry=structuredClone(fixtureEntries.find(e=>e.kind==='class')!);entry.id+=':second';entry.raw.multiclassing={proficienciesGained:{skills:[{choose:{from:['history','perception'],count:1}}]}};Object.assign(entry,irFixture(entry));
 c.selections.push({id:'second-owner',entry,level:1,quantity:1,equipped:false});syncFeatures(c,[...fixtureEntries,entry]);
 expect(sheetChoices(c,[...fixtureEntries,entry]).filter(r=>r.ownerId==='second-owner'&&r.channel==='skills').map(r=>r.count)).toEqual([1]);expect(sheetChoices(c).filter(r=>r.ownerId==='second-owner'&&r.channel==='equipment')).toHaveLength(0);
});
it('disabled sources park choices and resources without restoring spent uses when reenabled',()=>{
 const c=fixtureCharacter(),r=sheetChoices(c,fixtureEntries).find(r=>r.channel==='content')!;chooseSheetOption(c,r.id,r.options[0].value,fixtureEntries);syncFeatures(c,fixtureEntries);const id=Object.keys(c.runtime.resources).find(k=>k.startsWith('feature-resource:'))!;setResource(c,id,0);
 c.profile.enabledSources=[];syncFeatures(c,fixtureEntries);syncAutoResources(c);expect(sheetChoices(c,fixtureEntries).find(x=>x.id===r.id)?.restricted).toBe(true);expect(evaluate(c).ac).toBe(10);expect(c.runtime.resources[id]).toBeUndefined();
 c.profile.enabledSources=['XPHB'];syncFeatures(c,fixtureEntries);syncAutoResources(c);expect(evaluate(c).ac).toBe(12);expect(c.runtime.resources[id].current).toBe(0);
});
it('explicit rest recovery of a source spell updates its spent ledger and survives reconciliation',()=>{
 const c=fixtureCharacter(),entry=structuredClone(fixtureEntries[0]);entry.id='rest-origin';entry.kind='race';entry.name='休息来源';entry.english='Rest Origin';entry.entries=[];entry.raw={additionalSpells:[{ability:'wis',innate:{'1':{rest:{'1':['休息法术|XPHB']}}}}]};Object.assign(entry,irFixture(entry));c.selections.push({id:'rest-origin',entry,level:1,quantity:1,equipped:false});
 const spell=irFixture({...entry,id:'rest-spell',kind:'spell' as const,name:'休息法术',english:'Rest Spell',raw:{level:1}});Object.assign(entry,irFixture(entry,undefined,[entry,spell]));syncSourceSpells(c,[spell]);const grant=c.selections.find(s=>s.grantKey?.startsWith('source-spell:'))!,key=specialSpellResource(grant.id,c);changeSpecialSpellUses(c,grant.id,0);restResources(c,'short');expect(c.runtime.resources[key].current).toBe(1);syncSourceSpells(c,[spell]);expect(c.runtime.resources[key].current).toBe(1);
});
it('unknown resource formulas produce visible issues and pure evaluation leaves the character untouched',()=>{
 const c=fixtureCharacter();c.selections.find(s=>s.entry.name==='测试回气')!.entry.raw.resources[0].max='@untrusted + 1';Object.assign(c.selections.find(s=>s.entry.name==='测试回气')!.entry,irFixture(c.selections.find(s=>s.entry.name==='测试回气')!.entry));expect(planFeatureResources(c).issues[0].message).toContain('未执行');const before=JSON.stringify(c);for(let i=0;i<100;i++)evaluate(c);expect(JSON.stringify(c)).toBe(before);
 const invalid=fixtureCharacter();Object.values(invalid.runtime.resources).find(r=>r.featureGrant)!.featureGrant!.recovery.short=-1;expect(()=>validateCharacter(invalid)).toThrow();
});
it('resource formulas use active attribute effects and passive provenance follows the final perception value',()=>{
 const c=fixtureCharacter();c.abilities.wis=14;const feature=c.selections.find(s=>s.entry.name==='测试回气')!;feature.entry=structuredClone(feature.entry);feature.entry.raw.resources[0].max='@abilities.wis.mod + 1';Object.assign(feature.entry,irFixture(feature.entry));feature.entry.effects=[{op:'add',target:'wis',value:2}];Object.assign(feature.entry,irFixture(feature.entry));expect(planFeatureResources(c).grants[0].max).toBe(evaluate(c).modifiers.wis+1);
 c.adjustments=[{id:'perception-override',target:'skill:perception',value:7,reason:'原创验收修正'}];const d=evaluate(c);expect(d.passive).toBe(17);expect(d.trace.passive[0]).toBe('基础 10 + 察觉 7');
});
const directory=process.env.DND_AUTOMATION_CORE_DATA;
it('explicit rest rolls and healing are atomic, bounded, persistent and refuse stale or repeated requests',()=>{
 const c=fixtureCharacter();c.baseHp=20;c.runtime.hp=3;c.abilities.con=14;const id=Object.keys(c.runtime.resources).find(k=>k.startsWith('feature-resource:'))!;setResource(c,id,0);
 const request={id:'rest-one',kind:'short' as const,revision:c.revision,sequence:0,rolls:[{id:'hit-die:10',faces:10,value:7}],recover:{}};
 const receipt=performRest(c,request);expect([c.runtime.hp,c.runtime.resources['hit-die:10'].current,c.runtime.resources[id].current]).toEqual([12,0,1]);expect(receipt.rolls[0].value).toBe(7);expect(performRest(c,request)).toEqual(receipt);expect(c.runtime.hp).toBe(12);
 const before=JSON.stringify(c);expect(()=>performRest(c,{...request,id:'stale'})).toThrow();expect(JSON.stringify(c)).toBe(before);
 performRest(c,{id:'rest-two',kind:'long',revision:c.revision,sequence:1,rolls:[],recover:{'hit-die:10':1}});expect([c.runtime.hp,c.runtime.resources['hit-die:10'].current,c.runtime.resources[id].current]).toEqual([20,1,2]);expect(validateCharacter(exportCharacter(c)).runtime.rests).toEqual(c.runtime.rests);
 c.runtime.resources['hit-die:10'].max=5;expect(longRestHitDiceBudget(c)).toBe(5);c.edition='2014';expect(longRestHitDiceBudget(c)).toBe(2);
});
it.skipIf(!directory)('external 2014/2024 snapshots resolve real choice references and second-wind resources without name branches',()=>{
 for(const cls of ['fighter','cleric']){
  const entries=reviewCoreSamples(normalizeData(readReviewedClass(`${directory}/data_class_class-${cls}.json`),'external'));
  for(const edition of ['2014','2024'] as const){const c=newCharacter(edition);c.automation=newAutomationState();const entry=entries.find(e=>e.kind==='class'&&e.source===(edition==='2024'?'XPHB':'PHB'))!;c.selections=[{id:'owner',entry,quantity:1,level:1,equipped:false}];syncFeatures(c,entries);const choices=sheetChoices(c,entries);expect(choices.find(r=>r.channel==='skills')?.count).toBe(2);
   if(cls==='cleric'&&edition==='2024'){const r=choices.find(r=>r.label==='圣职')!;expect(r.options.map(o=>o.label)).toEqual(['保护者','奇术使']);expect(r.options.every(o=>o.grant)).toBe(true);}
   if(cls==='fighter'){const r=planFeatureResources(c).grants.find(r=>r.name==='回气')!;expect(r).toBeDefined();expect(r.max).toBe(edition==='2024'?2:1);expect(r.formula).toBe('1d10 + 1');expect(r.recovery).toEqual(edition==='2024'?{short:1,long:'all'}:{short:'all',long:'all'});
    if(edition==='2024')for(const [level,max] of [[4,3],[10,4]]){c.selections[0].level=level;syncFeatures(c,entries);const next=planFeatureResources(c).grants.filter(r=>r.name==='回气');expect(next).toHaveLength(1);expect(next[0].max).toBe(max);expect(next[0].key).toBe(r.key);}
   }
  }
 }
});
