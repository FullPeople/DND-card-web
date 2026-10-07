import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {it,expect} from 'vitest';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../../src/core/automation/choices';
import {syncFeatures} from '../../src/core/sheet';
import {evaluate} from '../../src/core/engine';
import {validateCharacter} from '../../src/core/validation';

it.skipIf(!process.env.DND_AUTOMATION_CORE_DATA||!process.env.DND_CLASS_CHOICE_PRE_DEDUP_OUTPUT).each([['paladin',2,'FS'],['ranger',2,'FS'],['warlock',19,'EB']] as const)('creates the pre-fix %s filter grant at actual source level %s', (name,level,category)=>{
 expect(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()).toBe('1a1717f84d9774f34194b9e57a45c247980cfba2');
 const dir=process.env.DND_CLASS_CHOICE_PRE_DEDUP_OUTPUT!,raw=JSON.parse(readFileSync(`${process.env.DND_AUTOMATION_CORE_DATA}/data_class_class-${name}.json`,'utf8'));
 const entries=normalizeData(raw,'external-pre-dedup-fixture'),c=newCharacter();c.id=`authored-pre-dedup-${name}`;c.name='原创实际来源验收';c.createdAt=c.updatedAt='2026-10-07T00:00:00.000Z';c.automation=newAutomationState();
 const feat:Entry={id:`authored-legacy-${category}`,kind:'feat',name:'原创旧来源专长',english:'Authored Legacy Source Feat',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{category},effects:[{op:'add',target:'ac',value:2}]};entries.push(feat);
 c.selections=[{id:'class-owner',entry:entries.find(entry=>entry.kind==='class'&&entry.source==='XPHB')!,level,quantity:1,equipped:false}];syncFeatures(c,entries);
 const feature=c.selections.find(row=>row.parentId==='class-owner'&&row.entry.raw.level===level&&row.entry.entries.some(text=>typeof text==='string'&&text.includes(`feats|category=${category}`)))!;
 const choice=sheetChoices(c,entries).find(choice=>choice.ownerId===feature.id&&choice.id.includes(':filter:')&&choice.options.some(option=>option.value===feat.id))!;
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncChoiceContent(c,entries);const granted=c.selections.find(row=>row.entry.id===feat.id)!;expect(granted.parentId).toBe(feature.id);expect(evaluate(c).ac).toBe(12);validateCharacter(c);
 mkdirSync(`${dir}`,{recursive:true});writeFileSync(`${dir}/${name}.json`,JSON.stringify({producerCommit:'1a1717f84d9774f34194b9e57a45c247980cfba2',sourceSample:name,level,category,entries,character:c,ids:{feature:feature.id,choice:choice.id,feat:granted.id,featEntry:feat.id}})+'\n');
});
