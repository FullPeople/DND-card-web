import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {displayCharacterEdit,applyDisplayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {entryNameIndex} from '../src/core/entryNameIndex';
import {syncFeatures} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {automationNeedsInitialization,initializeAutomation,newAutomationState} from '../src/core/automation/state';
import {evaluate} from '../src/core/engine';
const entry=(name:string,kind:Entry['kind']='feature',raw:Record<string,unknown>={}):Entry=>({id:`entry:${name}`,kind,name,english:name,edition:'2024',source:'XPHB',packId:'authored',revision:'1',entries:['Original regression fixture.'],raw});
describe('explicit display edits',()=>{
 it('only marked name and player setters share mechanics and never mutate old history snapshots',()=>{
  const c=newCharacter();c.automation=newAutomationState();c.runtime.resources.spent={name:'Spent',current:1,max:5};c.selections=[{id:'feature',entry:entry('Feature'),level:1,equipped:false,quantity:1}];
  const original=structuredClone(c),next=applyDisplayCharacterEdit(c,displayCharacterEdit('name','Changed'))!;
  expect(next).toEqual({...c,name:'Changed'});expect(next).not.toBe(c);expect(next.selections).toBe(c.selections);expect(next.runtime).toBe(c.runtime);expect(sameCharacterMechanics(c,next)).toBe(true);expect(evaluate(next)).toEqual(evaluate(c));expect(c).toEqual(original);
  const player=applyDisplayCharacterEdit(next,displayCharacterEdit('player','Player'))!;expect(player.runtime.resources.spent.current).toBe(1);expect(sameCharacterMechanics(c,player)).toBe(true);expect(applyDisplayCharacterEdit(player,displayCharacterEdit('player','Player'))).toBe(player);
  const later=structuredClone(player);later.runtime.resources.spent.current=0;expect(c).toEqual(original);expect(player.runtime.resources.spent.current).toBe(1);expect(sameCharacterMechanics(player,later)).toBe(false);
 });
 it('ordinary callbacks cannot opt out, even if they set a display field',()=>{const c=newCharacter();expect(applyDisplayCharacterEdit(c,d=>{d.name='changed';})).toBeUndefined();expect(applyDisplayCharacterEdit(c,d=>{d.baseHp=99;})).toBeUndefined();});
 it('every non-display key including unknown future data invalidates the rules view',()=>{
  const c=newCharacter();for(const key of Object.keys(c).filter(key=>!['name','player','revision','updatedAt'].includes(key))){const value=c[key as keyof Character];const changed=typeof value==='object'?structuredClone(value):typeof value==='number'?value+1:typeof value==='boolean'?!value:String(value)+'changed';expect(sameCharacterMechanics(c,{...c,[key]:changed})).toBe(false);}
  expect(sameCharacterMechanics(c,{...c,futureRule:1} as Character)).toBe(false);expect(sameCharacterMechanics(undefined,c)).toBe(false);expect(sameCharacterMechanics(c,{...c,revision:100,updatedAt:'new'})).toBe(true);
 });
 it('initialization predicate exactly matches the existing migration behavior including opt-outs and unknown versions',()=>{
  for(const automation of [undefined,newAutomationState(),{...newAutomationState(),enabled:false},{...newAutomationState(),defaultsVersion:undefined},{...newAutomationState(),protocol:99},{...newAutomationState(),rulesVersion:'future'}]){const c=newCharacter();c.automation=automation;expect(automationNeedsInitialization(c)).toBe(initializeAutomation(structuredClone(c)));}
 });
});
describe('catalog snapshot name index',()=>{
 it('retains saved-first and review-published-first resolution with duplicates and bilingual names',()=>{
  const saved=entry('Gift','feat',{old:true}),published={...saved,english:'Gift English',raw:{new:true}},owner=entry('Owner','background',{feats:[{'Gift|XPHB':true}]});const c=newCharacter();c.selections=[{id:'owner',entry:owner,level:1,equipped:false,quantity:1},{id:'oldgift',entry:saved,level:1,equipped:false,quantity:1}];
  syncFeatures(c,[published],undefined,entryNameIndex([published]));expect(c.selections.find(s=>s.parentId==='owner')?.entry.raw.old).toBe(true);
  syncFeatures(c,[published],{owners:new Set(['owner']),refresh:true},entryNameIndex([published]));expect(c.selections.find(s=>s.parentId==='owner')?.entry.raw.new).toBe(true);expect(entryNameIndex([published]).get('gift english')).toEqual([published]);
 });
 it('new catalog snapshots expose a previously missing grant and default calls tolerate in-place array edits',()=>{
  const owner=entry('Class','class',{classFeatures:['Gift|Class|XPHB|1']}),gift=entry('Gift','feature',{className:'Class',classSource:'XPHB',level:1});const c=newCharacter();c.selections=[{id:'owner',entry:owner,level:1,equipped:false,quantity:1}];const empty:Entry[]=[];syncFeatures(c,empty,undefined,entryNameIndex(empty));expect(c.selections).toHaveLength(1);
  const catalog=[gift];syncFeatures(c,catalog,undefined,entryNameIndex(catalog));expect(c.selections).toHaveLength(2);const other=newCharacter();other.selections=[{...c.selections[0],entry:{...owner,raw:{classFeatures:['Later|Class|XPHB|1']}}}];catalog.push({...gift,id:'later',name:'Later',english:'Later'});syncFeatures(other,catalog);expect(other.selections[1].entry.name).toBe('Later');
 });
 it('class and level changes still grant declared features and preserve spent resources',()=>{
  const gift=entry('Gift','feature',{className:'Class',classSource:'XPHB',level:2}),owner=entry('Class','class',{classFeatures:['Gift|Class|XPHB|2'],hd:{faces:8}});const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:owner,level:1,equipped:false,quantity:1}];c.runtime.resources.manual={name:'Manual',current:2,max:7};const catalog=[gift],index=entryNameIndex(catalog);syncFeatures(c,catalog,undefined,index);expect(c.selections).toHaveLength(1);c.selections[0].level=2;syncFeatures(c,catalog,undefined,index);syncAutoResources(c);expect(c.selections).toHaveLength(2);expect(c.runtime.resources.manual.current).toBe(2);
 });
});
