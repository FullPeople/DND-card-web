import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {entryDragPage,optionalFeatureLearningDrop} from '../src/ui/entryDragIntent';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {candidateReason} from '../src/core/engine';

it.each(['AI','EI'])('routes the actual normalized %s feature kind and preserves an active choice page',type=>{
 const [entry]=normalizeData({optionalfeature:[{name:'原创拖拽记录',source:type==='AI'?'TCE':'XPHB',featureType:[type],entries:[]}]},'authored-regression');
 expect(entry.kind).toBe('feature');expect(entry.raw._category).toBe('optionalfeature');
 expect(entryDragPage(entry,'entry')).toBe('特性');expect(entryDragPage(entry,'entry',true)).toBeUndefined();
});

it.each(['subclass','feat'] as const)('preserves manual maneuver drops with automation enabled and a %s owner without class progression',kind=>{
 const entries=normalizeData({class:[{name:'原创基础职业',source:'PHB'}],subclass:[{name:'原创战术子职',source:'PHB',className:'原创基础职业',classSource:'PHB'}],feat:[{name:'原创战术专长',source:'PHB'}],optionalfeature:[{name:'原创战技',source:'PHB',featureType:['MM'],entries:['手动记录。']}]},'manual-option-scope');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 c.selections=entries.filter(entry=>entry.kind==='class'||entry.kind===kind).map((entry,i)=>({id:`owner-${i}`,entry,level:6,quantity:1,equipped:false}));
 const maneuver=entries.find(entry=>entry.raw._category==='optionalfeature')!,before=JSON.stringify(c);
 expect(optionalFeatureLearningDrop(c,maneuver,entries),'unowned optional features must reach the existing manual add path').toBeUndefined();
 expect(candidateReason(c,maneuver)).toBeUndefined();expect(entryDragPage(maneuver,'entry')).toBe('特性');expect(JSON.stringify(c)).toBe(before);
});

it('preserves manual drops for an unrelated declared class optional progression',()=>{
 const entries=normalizeData({class:[{name:'原创战术职业',source:'PHB',optionalfeatureProgression:[{name:'原创战术',featureType:['MM'],progression:{'3':3}}]}],optionalfeature:[{name:'原创战技',source:'PHB',featureType:['MM'],entries:[]}]},'manual-class-option');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:6,quantity:1,equipped:false}];
 expect(optionalFeatureLearningDrop(c,entries.find(entry=>entry.raw._category==='optionalfeature')!,entries)).toBeUndefined();
});

it.each(['AI','EI'])('only intercepts an owned %s learning progression and retains its unavailable boundary',type=>{
 const source=type==='AI'?'TCE':'XPHB',entries=normalizeData({class:[{name:'原创学习职业',source,optionalfeatureProgression:[{name:'原创学习',featureType:[type.toLowerCase()],progression:{'2':2}}]}],optionalfeature:[{name:'原创学习项',source,featureType:[type],entries:[],prerequisite:[{spell:[{choose:'unverified'}]}]}]},'owned-learning-scope');
 const c=newCharacter(type==='AI'?'2014':'2024');c.automation=newAutomationState();c.profile.enabledSources=[source];c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:2,quantity:1,equipped:false}];
 const entry=entries.find(entry=>entry.raw._category==='optionalfeature')!;
 const drop=optionalFeatureLearningDrop(c,entry,entries);expect(drop?.choice?.sourceProgression).toBe('optional');expect(drop?.choice?.options[0].unavailable).toContain('手动核对');expect(drop?.choice?.options[0].grant).toBeUndefined();
 c.automation.enabled=false;expect(optionalFeatureLearningDrop(c,entry,entries)).toBeUndefined();
 c.automation.enabled=true;c.selections=[];expect(optionalFeatureLearningDrop(c,entry,entries)).toBeUndefined();
});
