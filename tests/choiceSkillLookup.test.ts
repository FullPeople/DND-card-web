import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices} from '../src/core/automation/choices';

it.each(['2014','2024'] as const)('skill choices retain edition and saved-entry precedence for %s',edition=>{
 const source=edition==='2014'?'PHB':'XPHB',catalog=normalizeData({class:[{name:'Fixture class',source,startingProficiencies:{skills:[{choose:{from:['athletics','perception'],count:1}}]}}],skill:[{name:'Athletics',source:'PHB',entries:['2014']},{name:'Athletics',source:'XPHB',entries:['2024']},{name:'Perception',source,entries:['Published']} ]},'published');
 const c=newCharacter(edition);c.automation=newAutomationState();
 const original=catalog.find(entry=>entry.name==='Perception')!,saved={...original,revision:'saved',entries:['Saved selection']};
 c.selections=[{id:'class',entry:catalog.find(entry=>entry.kind==='class')!,level:1,quantity:1,equipped:false},{id:'saved-skill',entry:saved,level:1,quantity:1,equipped:false}];
 const options=sheetChoices(c,catalog).find(choice=>choice.channel==='skills')!.options;
 expect(options.find(option=>option.value==='athletics')?.entry.source).toBe(source);
 expect(options.find(option=>option.value==='perception')?.entry).toBe(saved);
});
