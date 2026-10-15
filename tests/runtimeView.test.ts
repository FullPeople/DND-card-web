import {describe,it,expect} from 'vitest';
import {RuntimeViews,applyCharacterRuntimeView,displayRuntimeDerived,type RuntimeView} from '../src/platform/runtimeView';
import {evaluate} from '../src/core/engine';
import {newCharacter,type Entry} from '../src/core/model';
import {documentChanges} from '../src/platform/document-delta';
import {syncAutoResources} from '../src/core/resources';
import type {CacheAccess} from '../src/platform/workbench-cache';

const access=(epoch=1):CacheAccess=>({room:'room',scope:'room:scene',epoch,role:'GM',enabled:{characterCards:true},cards:[{id:'a',itemId:'token-a',itemIds:['token-a'],write:true,locked:false,grantVersion:'owner1'}],monsters:[]});
const view=(observation=1,patch:Partial<RuntimeView>={}):RuntimeView=>({version:1,observation,documentRevision:1,tokenRevision:1,tokenId:'token-a',pending:true,stats:{health:9,'temporary health':2,'max health':20,'armor class':15},resources:[{id:'spell-slot:1',current:1,max:4,name:'一环法术位'}],conditions:[],...patch});
const card=(runtimeView?:RuntimeView)=>({id:'a',cardId:'a',itemId:'token-a',documentRevision:1,stats:{health:10},resources:[],conditions:[],runtimeView});

describe('runtime view ordering and authorization',()=>{
 it('shows observations without changing the canonical document version or payload',()=>{
  const views=new RuntimeViews();views.restrict(access());const raw=card(view());views.remember(raw);const displayed=views.project(raw);
  expect(displayed.stats.health).toBe(9);expect(displayed.documentRevision).toBe(1);expect(raw.stats.health).toBe(10);
  expect(views.project(raw)).toBe(displayed);
 });
 it('accepts native edits sharing one baseline, rejects late observations and old durable projections',()=>{
  const views=new RuntimeViews();views.restrict(access());views.remember(card(view(2,{stats:{health:8}})));views.remember(card(view(1,{stats:{health:9}})));
  expect(views.project(card()).stats.health).toBe(8);
  views.remember(card(view(3,{tokenRevision:2,stats:{health:7}})));views.remember(card(view(4,{stats:{health:9}})));
  expect(views.project(card()).stats.health).toBe(7);expect(views.project(card()).documentRevision).toBe(1);
  expect(views.project({...card(),documentRevision:3,stats:{health:6}},3).stats.health).toBe(6);
 });
 it('clears runtime on revocation, regrant, scope and token binding changes',()=>{
  const views=new RuntimeViews();views.restrict(access());views.remember(card(view()));views.restrict({...access(2),cards:[]});
  expect(views.project(card()).runtimeView).toBeUndefined();views.restrict(access(3));expect(views.project(card()).stats.health).toBe(10);
  views.remember(card(view()));views.restrict({...access(4),scope:'room:other-scene'});expect(views.project(card()).stats.health).toBe(10);
  views.remember(card(view()));views.restrict({...access(5),scope:'room:other-scene',cards:[{...access().cards[0],itemId:'other',itemIds:['other']}]});expect(views.project(card()).stats.health).toBe(10);
 });
 it('cannot substitute another token or retain malformed partial values',()=>{
  const views=new RuntimeViews();views.restrict(access());views.remember(card(view(1,{tokenId:'private-token'})));expect(views.project(card()).stats.health).toBe(10);
  views.remember(card(view(2,{resources:[{id:'x',current:NaN,max:4}]})));expect(views.project(card()).stats.health).toBe(10);
  views.remember(card(view(3)));expect(views.project(card(),0,false).runtimeView).toBeUndefined();
 });
});

describe('detached native character runtime',()=>{
 it('does not recreate an explicitly removed manual slot on the next edit',()=>{
  const character=newCharacter();character.spellSettings={slots:{'1':{max:4,used:3}}} as any;character.runtime.resources={'spell-slot:1':{name:'slot',current:1,max:4}};
  const document={dnd_card_web:structuredClone(character)},shown=structuredClone(character);
  applyCharacterRuntimeView(shown,view(1,{resources:[]}),document);syncAutoResources(shown);
  expect(shown.runtime.resources['spell-slot:1']).toBeUndefined();expect(shown.spellSettings!.slots).toEqual({});expect(document.dnd_card_web.spellSettings!.slots['1'].used).toBe(3);
 });
 it('preserves manual document hydration when a metadata view changes only HP',()=>{
  const character=newCharacter();character.spellSettings={slots:{'1':{max:4,used:3}}} as any;
  const document={dnd_card_web:structuredClone(character)};syncAutoResources(character);applyCharacterRuntimeView(character,view(1,{resources:[]}),document);
  expect(character.runtime.resources['spell-slot:1'].current).toBe(1);expect(character.spellSettings!.slots['1'].used).toBe(3);
 });
 it('displays newer committed AC only until its document arrives without changing character calculations',()=>{
  const character=newCharacter(),before=structuredClone(character),derived=evaluate(character);
  const shown=displayRuntimeDerived(derived,view(1,{tokenRevision:2,stats:{'armor class':19}}),1);
  expect(shown.ac).toBe(19);expect(derived.ac).not.toBe(19);expect(character).toEqual(before);
  expect(displayRuntimeDerived(derived,view(1,{tokenRevision:2,stats:{'armor class':19}}),2)).toBe(derived);
 });
 it('preserves consumed slots, removes a native condition, and leaves the saved document untouched',()=>{
  const original=newCharacter();original.baseHp=20;original.runtime.hp=10;original.runtime.tempHp=0;
  original.spellSettings={slots:{'1':{max:4,used:0}}} as any;
  const condition:Entry={id:'poison',kind:'condition',name:'中毒',english:'Poisoned',source:'PHB',edition:'both',packId:'test',revision:'1',entries:[],raw:{_suiteStatusId:'poison'}};
  original.selections.push({id:'condition',entry:condition,level:1,quantity:1,equipped:false});const frozen=structuredClone(original),shown=structuredClone(original),document={_suiteRevision:1,dnd_card_web:original,core_stats:{hp:{max:20}}};
  syncAutoResources(shown);applyCharacterRuntimeView(shown,view(),document);
  expect(shown.runtime.hp).toBe(9);expect(shown.runtime.tempHp).toBe(2);expect(shown.runtime.resources['spell-slot:1'].current).toBe(1);expect(shown.spellSettings!.slots['1']).toEqual({max:4,used:3});expect(shown.selections).toEqual([]);
  expect(original).toEqual(frozen);expect(shown.adjustments).toEqual(original.adjustments);expect(shown.revision).toBe(original.revision);
  const after=structuredClone(shown);after.name='改名';const delta=documentChanges(shown,after,original);
  expect(delta.map(row=>row.path.join('.'))).toEqual(['name']);
 });
 it('keeps explicit condition identity and level, and does not install an AC override',()=>{
  const character=newCharacter(),entry:Entry={id:'condition-a',kind:'condition',name:'同名状态',english:'A',source:'TCE',edition:'both',packId:'test',revision:'saved',entries:[],raw:{}};
  character.selections=[{id:'saved',entry,level:2,quantity:1,equipped:false}];character.adjustments=[{id:'other',target:'ac',value:17,reason:'manual'}];
  applyCharacterRuntimeView(character,view(1,{conditions:[{id:'web:condition-a',name:entry.name,entry,level:3}],stats:{health:1,'armor class':99,'max health':21}}),{core_stats:{hp:{max:20}}});
  expect(character.selections[0].id).toBe('saved');expect(character.selections[0].level).toBe(3);expect(character.adjustments.filter(row=>row.target==='ac')).toEqual([{id:'other',target:'ac',value:17,reason:'manual'}]);expect(character.adjustments.find(row=>row.target==='hp')?.value).toBe(21);
 });
});
