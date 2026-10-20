import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {chooseCantrip,clearCantrip} from '../src/core/spellWorkspace';
import {validateCharacter} from '../src/core/validation';

const fixturePath=process.env.DND_INVOCATION_LEARNING_FIXTURE;
function real(){
 const input=JSON.parse(readFileSync(fixturePath!,'utf8'));
 expect(input.playerDocumentsRead).toBe(false);
 const entries=normalizeData({...input.classBody,optionalfeature:input.optionalfeature,spell:[input.spell]},'frozen-invocation-repro');
 const spell=entries.find(e=>e.kind==='spell')!;
 const lookup=input.lookup[spell.source.toLowerCase()]?.[spell.name.toLowerCase()]||input.lookup[spell.source.toLowerCase()]?.[spell.english.toLowerCase()];
 spell.raw._spellClasses=lookup?.class;expect(spell.raw._spellClasses).toBeDefined();
 const owner=entries.find(e=>e.kind==='class'&&e.source==='XPHB')!;
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:owner,level:3,quantity:1,equipped:false}];
 c.notes='原创手工记录';c.runtime.hp=3;c.runtime.resources.authored={name:'原创已消耗资源',max:3,current:1};
 syncFeatures(c,entries);
 const learned=()=>sheetChoices(c,entries).find(choice=>choice.id==='owner:class-optional:0')!;
 return {c,entries,spell,learned};
}

it('has one source progression and keeps the exact learned slots through level changes and reopen',()=>{
 const entries=normalizeData({class:[{name:'原创双入口核对',source:'XPHB',classFeatures:['原创学习|原创双入口核对|XPHB|1'],optionalfeatureProgression:[{name:'原创学习',featureType:['EI'],progression:[1,...Array(19).fill(3)]}]}],classFeature:[{name:'原创学习',source:'XPHB',className:'原创双入口核对',classSource:'XPHB',level:1,entries:['原创阅读入口：{@filter 原创选项|optionalfeatures|feature type=EI|source=XPHB}。']}],optionalfeature:[{name:'原创甲',source:'XPHB',featureType:['EI'],entries:[]},{name:'原创乙',source:'XPHB',featureType:['EI'],entries:[]}]},'authored');
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level:1,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choice=()=>sheetChoices(c,entries).filter(row=>row.sourceProgression==='optional');
 expect(choice()).toHaveLength(1);expect(choice()[0].count).toBe(1);
 setSheetChoiceSlot(c,choice()[0].id,0,entries.find(e=>e.name==='原创甲')!.id,entries);
 c.selections[0].level=3;syncFeatures(c,entries);expect(choice()).toHaveLength(1);expect(choice()[0].count).toBe(3);
 setSheetChoiceSlot(c,choice()[0].id,2,entries.find(e=>e.name==='原创乙')!.id,entries);
 const answers=structuredClone(c.answers),reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(reopened.answers).toEqual(answers);
 reopened.selections[0].level=1;syncFeatures(reopened,entries);
 expect(reopened.answers).toEqual(answers);expect(sheetChoices(reopened,entries).find(row=>row.sourceProgression==='optional')!.slots).toHaveLength(3);
});

it.skipIf(!fixturePath)('the three real source prerequisites accept a learned, matching damaging class cantrip',()=>{
 const {c,entries,spell,learned}=real();expect(chooseCantrip(c,spell,'owner').error).toBeUndefined();
 const options=learned().options.filter(option=>['Agonizing Blast','Eldritch Spear','Repelling Blast'].includes(option.entry.english));expect(options).toHaveLength(3);
 for(const option of options)expect(option.unavailable,option.entry.english).toBeUndefined();
 const before=structuredClone({runtime:c.runtime,notes:c.notes,abilities:c.abilities});
 for(const [index,option] of options.entries())setSheetChoiceSlot(c,learned().id,index,option.value,entries);syncChoiceContent(c,entries);
 expect(learned().complete).toBe(true);
 const reopened=validateCharacter(JSON.parse(JSON.stringify(c)));expect(reopened.answers).toEqual(c.answers);expect(reopened.runtime).toEqual(before.runtime);expect(reopened.notes).toBe(before.notes);expect(reopened.abilities).toEqual(before.abilities);
 clearCantrip(c,'owner',0);expect(learned().selected).toEqual([]);expect(c.answers[learned().id][0]).toBe(options[0].value);expect(learned().slots![0]).toBe(options[0].value);
 expect(chooseCantrip(c,spell,'owner').error).toBeUndefined();expect(learned().selected).toEqual(options.map(option=>option.value));
});

it.skipIf(!fixturePath)('preserves the learned snapshot through source-off, import, level loss and legal recovery',()=>{
 const {c,entries,spell,learned}=real();expect(chooseCantrip(c,spell,'owner').error).toBeUndefined();
 const option=learned().options.find(option=>option.entry.english==='Agonizing Blast')!;setSheetChoiceSlot(c,learned().id,0,option.value,entries);
 const saved=structuredClone({answers:c.answers,snapshots:c.classChoiceSnapshots,runtime:c.runtime,abilities:c.abilities,notes:c.notes}),sources=[...c.profile.enabledSources];
 c.profile.enabledSources=[];syncChoiceContent(c,entries);expect(learned().selected).toEqual([]);expect(learned().restricted).toBe(true);expect(c.answers).toEqual(saved.answers);
 const imported=validateCharacter(JSON.parse(JSON.stringify(c)));imported.profile.enabledSources=sources;
 const current=()=>sheetChoices(imported,[]).find(choice=>choice.id==='owner:class-optional:0')!;
 expect(current().selected).toEqual([option.value]);
 imported.selections.find(row=>row.id==='owner')!.level=1;syncChoiceContent(imported,[]);expect(current().selected).toEqual([]);expect(current().slots![0]).toBe(option.value);
 imported.selections.find(row=>row.id==='owner')!.level=3;syncChoiceContent(imported,[]);expect(current().selected).toEqual([option.value]);
 expect(imported.answers).toEqual(saved.answers);expect(imported.classChoiceSnapshots).toEqual(saved.snapshots);expect(imported.runtime).toEqual(saved.runtime);expect(imported.abilities).toEqual(saved.abilities);expect(imported.notes).toBe(saved.notes);
});

it.skipIf(!fixturePath)('does not confuse a damage save with a damaging attack prerequisite',()=>{
 const {c,spell,learned}=real();delete spell.raw.spellAttack;expect(chooseCantrip(c,spell,'owner').error).toBeUndefined();
 expect(learned().options.find(option=>option.entry.english==='Agonizing Blast')!.unavailable).toBeUndefined();
 expect(learned().options.find(option=>option.entry.english==='Eldritch Spear')!.unavailable).toBeUndefined();
 expect(learned().options.find(option=>option.entry.english==='Repelling Blast')!.unavailable).toBeTruthy();
});

it.skipIf(!fixturePath).each(['unlearned','nondamaging','other-class','disabled-spell','wrong-edition','level-one','changed-source-condition'])('keeps %s unavailable without changing the saved card',reason=>{
 const {c,entries,spell,learned}=real();
 if(reason!=='unlearned')expect(chooseCantrip(c,spell,'owner').error).toBeUndefined();
 const stored=c.selections.find(row=>row.entry.kind==='spell');
 if(reason==='nondamaging')delete stored!.entry.raw.damageInflict;
 if(reason==='other-class'){c.spellSettings!.cantrips!.other=c.spellSettings!.cantrips!.owner;c.spellSettings!.cantrips!.owner=[];}
 if(reason==='disabled-spell')c.profile.disabledEntries=[stored!.entry.id];
 if(reason==='wrong-edition')stored!.entry.edition='2014';
 if(reason==='level-one')c.selections[0].level=1;
 if(reason==='changed-source-condition')for(const entry of entries.filter(entry=>entry.raw._category==='optionalfeature'))entry.raw.prerequisite[0].spell[0].entrySummary='原创未审语义';
 const before=JSON.stringify(c),options=learned().options.filter(option=>['Agonizing Blast','Eldritch Spear','Repelling Blast'].includes(option.entry.english));
 expect(options).toHaveLength(3);expect(options.every(option=>!!option.unavailable)).toBe(true);expect(JSON.stringify(c)).toBe(before);
});
