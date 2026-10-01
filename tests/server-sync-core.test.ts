import {describe,it,expect} from 'vitest';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {applyCanonicalOperations,escapePointer,operationPaths,parsePointer,pathOverlap,readPath,OperationError} from '../src/core/sync/operations';
import {buildOperations,diffDocuments,orderMoves} from '../src/core/sync/diff';
import type {Operation,OperationResult} from '../src/core/sync/protocol';
import {absorbResults,baseRevisionFor,staleConflicts,contextOf} from '../src/platform/server/characterSync';
import {SYNC_SCHEMA,recoverRecord,type PendingEntry,type SyncRecord} from '../src/platform/server/syncStore';

// Original synthetic data only.
const entry=(id:string,kind:Entry['kind']='item'):Entry=>({id,kind,name:'测试'+id,english:'Test '+id,source:'CUSTOM',edition:'2024',packId:'test',revision:'1',entries:['原创测试正文'],raw:{}});
const selection=(id:string,extra:Partial<Selection>={}):Selection=>({id,entry:entry('e-'+id),quantity:1,level:1,equipped:false,...extra});
function character():Character{
  const c=newCharacter('2024');c.id='legacy-doc-id';c.name='协议测试角色';c.runtime.hp=20;c.baseHp=20;
  c.selections=[selection('A'),selection('B'),selection('C')];
  c.quickbarActions=[{id:'action-A',name:'测试攻击',attack:'1d20+3',damage:'1d6'},{id:'action-B',name:'测试二',attack:'1d20',damage:'1d4'}];
  c.runtime.resources={'custom-pool':{current:2,max:3,name:'测试次数'}};
  c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:['','A',''],slots:{'1':{max:2,used:0}}};
  c.inventory={view:'grid',order:['A','B','C'],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:5,pp:0}};
  return c;
}

describe('canonical operation reducer (protocol samples)',()=>{
  it('applies the six documented operations without touching the input',()=>{
    const c=character(),frozen=structuredClone(c);
    const next=applyCanonicalOperations(c,[
      {op:'set',path:'/abilities/str',value:16},
      {op:'inc',path:'/runtime/hp',value:-5},
      {op:'unset',path:'/biography'},
      {op:'entity.upsert',path:'/quickbarActions',entityId:'action-C',value:{id:'action-C',name:'新动作',attack:'1d20',damage:'1d8'}},
      {op:'order.move',path:'/quickbarActions',entityId:'action-B',beforeId:'action-A'},
      {op:'entity.delete',path:'/quickbarActions',entityId:'action-A'},
      {op:'entity.upsert',path:'/runtime/resources',entityId:'pool-2',value:{current:1,max:1,name:'第二池'}},
      {op:'set',path:'/selections/entities/B/quantity',value:4},
    ]);
    expect(c).toEqual(frozen);
    expect(next.abilities.str).toBe(16);expect(next.runtime.hp).toBe(15);
    expect(next.quickbarActions!.map(a=>a.id)).toEqual(['action-B','action-C']);
    expect(next.runtime.resources['pool-2'].current).toBe(1);
    expect(next.selections.find(s=>s.id==='B')!.quantity).toBe(4);
    expect(next.selections.map(s=>s.id)).toEqual(['A','B','C']);
  });
  it('is atomic: one failing operation leaves the original document',()=>{
    const c=character();
    expect(()=>applyCanonicalOperations(c,[{op:'set',path:'/name',value:'新名'},{op:'inc',path:'/name',value:1}])).toThrow(OperationError);
    expect(c.name).toBe('协议测试角色');
  });
  it('rejects array indexes, protected metadata, unknown roots and prototype keys',()=>{
    const c=character();
    for(const op of [
      {op:'set',path:'/selections/0/quantity',value:2},
      {op:'set',path:'/spellSettings/prepared/0',value:'B'},
      {op:'set',path:'/revision',value:9},{op:'set',path:'/id',value:'x'},{op:'set',path:'/createdAt',value:'x'},
      {op:'set',path:'/mystery',value:1},
      {op:'set',path:'/profile/__proto__/x',value:1},
      {op:'set',path:'/selections/entities/A/id',value:'Z'},
      {op:'set',path:'/biography/story',value:'parent missing'},
      {op:'inc',path:'/runtime/resources/missing/current',value:-1},
      {op:'order.move',path:'/quickbarActions',entityId:'action-A',beforeId:'action-A'},
      {op:'order.move',path:'/inventory/order',entityId:'A'},
      {op:'entity.upsert',path:'/quickbarActions',entityId:'x',value:{id:'y',name:'',attack:'',damage:''}},
    ] as Operation[])expect(()=>applyCanonicalOperations(c,[op]),JSON.stringify(op)).toThrow(OperationError);
  });
  it('escapes pointers with ~0/~1, not URL encoding',()=>{
    const c=character();c.runtime.resources['a/b~c']={current:3,max:3};
    expect(escapePointer('a/b~c')).toBe('a~1b~0c');
    const path='/runtime/resources/'+escapePointer('a/b~c')+'/current';
    expect(parsePointer(path)).toEqual(['runtime','resources','a/b~c','current']);
    expect(applyCanonicalOperations(c,[{op:'inc',path,value:-1}]).runtime.resources['a/b~c'].current).toBe(2);
    expect(()=>parsePointer('/a~2b')).toThrow();
  });
  it('keeps empty prepared slots as an atomic value array',()=>{
    const next=applyCanonicalOperations(character(),[{op:'set',path:'/spellSettings/prepared',value:['','','B']}]);
    expect(next.spellSettings!.prepared).toEqual(['','','B']);
  });
  it('touched paths and overlap match the server conflict algorithm',()=>{
    expect(operationPaths({op:'order.move',path:'/quickbarActions',entityId:'a',beforeId:'b'})).toEqual(['/quickbarActions/entities/a','/quickbarActions/order','/quickbarActions/entities/b']);
    expect(operationPaths({op:'entity.delete',path:'/runtime/resources',entityId:'p'})).toEqual(['/runtime/resources/p']);
    expect(pathOverlap('/profile','/profile/optional/feats')).toBe(true);
    expect(pathOverlap('/a','/ab')).toBe(false);
  });
  it('reads missing apart from null',()=>{
    const c=character();(c as any).notes=null;
    expect(readPath(c,'/notes')).toEqual({exists:true,value:null});
    expect(readPath(c,'/biography')).toEqual({exists:false});
    expect(readPath(c,'/selections/entities/B/quantity')).toEqual({exists:true,value:1});
  });
});

describe('edit → operations',()=>{
  it('typed numbers are set; declared increments are inc',()=>{
    const before=character(),after=structuredClone(before);after.abilities.str=16;after.runtime.hp=15;after.name='改名';
    expect(diffDocuments(before,after)).toEqual(expect.arrayContaining([{op:'set',path:'/abilities/str',value:16},{op:'set',path:'/runtime/hp',value:15},{op:'set',path:'/name',value:'改名'}]));
    expect(diffDocuments(before,after,{inc:['/runtime/hp']})).toContainEqual({op:'inc',path:'/runtime/hp',value:-5});
  });
  it('addresses selections by stable ID, never by index, and cleans references in the same batch',()=>{
    const before=character(),after=structuredClone(before);
    after.selections=after.selections.filter(s=>s.id!=='A');after.selections.find(s=>s.id==='B')!.quantity=3;after.selections.push(selection('D'));
    after.spellSettings!.prepared=['','',''];after.inventory!.order=['B','C','D'];
    const ops=buildOperations({server:before,next:after});
    expect(ops).toContainEqual({op:'entity.delete',path:'/selections',entityId:'A'});
    expect(ops).toContainEqual({op:'set',path:'/selections/entities/B/quantity',value:3});
    expect(ops).toContainEqual(expect.objectContaining({op:'entity.upsert',path:'/selections',entityId:'D'}));
    expect(ops).toContainEqual({op:'set',path:'/spellSettings/prepared',value:['','','']});
    expect(ops).toContainEqual({op:'set',path:'/inventory/order',value:['B','C','D']});
    expect(ops.some(op=>/\/\d+(\/|$)/.test(op.path))).toBe(false);
    expect(applyCanonicalOperations(before,ops)).toEqual({...after,selections:after.selections});
  });
  it('reorders registered arrays with order.move only when the user reordered',()=>{
    const before=character(),after=structuredClone(before);after.selections=[after.selections[2],after.selections[0],after.selections[1]];
    const ops=buildOperations({server:before,next:after});
    expect(ops.every(op=>op.op==='order.move')).toBe(true);
    expect(applyCanonicalOperations(before,ops).selections.map(s=>s.id)).toEqual(['C','A','B']);
    for(const [from,to] of [[['a','b','c','d'],['d','c','b','a']],[['a','b','c','d','e'],['b','a','e','c','d']]])
      expect(orderMoves('/x',from,to).length).toBeLessThan(from.length);
  });
  it('resources use map keys: upsert/delete rows, set/inc fields',()=>{
    const before=character(),after=structuredClone(before);after.runtime.resources['custom-pool'].current=1;after.runtime.resources['new-pool']={current:1,max:1};
    const ops=buildOperations({server:before,next:after,intent:{inc:['/runtime/resources/custom-pool/current']}});
    expect(ops).toContainEqual({op:'inc',path:'/runtime/resources/custom-pool/current',value:-1});
    expect(ops).toContainEqual({op:'entity.upsert',path:'/runtime/resources',entityId:'new-pool',value:{current:1,max:1}});
  });
  it('never uploads metadata, and hydration-only differences stay local',()=>{
    const server=character(),base=structuredClone(server);
    // Hydration adds an automatic feature and a derived resource the user did not edit.
    base.selections.push(selection('auto-feature'));base.runtime.resources['spell-slot:1']={current:2,max:2,automatic:true};
    const next=structuredClone(base);next.name='只改名字';next.revision=99;next.updatedAt='x';next.id='other';
    expect(buildOperations({server,base,next})).toEqual([{op:'set',path:'/name',value:'只改名字'}]);
  });
  it('anchors a field edit beneath a hydrated branch at the deepest server parent',()=>{
    const server=character();delete server.spellSettings;
    const base=structuredClone(server);base.spellSettings={mode:'known',ability:'int',capacity:0,attackBonus:0,dcBonus:0,prepared:[],slots:{}};
    const next=structuredClone(base);next.spellSettings!.capacity=2;
    const ops=buildOperations({server,base,next});
    expect(ops).toEqual([{op:'set',path:'/spellSettings',value:next.spellSettings}]);
    expect(applyCanonicalOperations(server,ops).spellSettings!.capacity).toBe(2);
  });
});

const result=(revision:number,operationId:string,operations:Operation[]):OperationResult=>({characterId:'srv',revision,baseRevision:revision-1,operationId,clientId:'c',origin:'web',operations,touchedPaths:[],updatedAt:`2026-10-01T00:00:0${revision}Z`,rebased:false});
function record(outbox:PendingEntry[]=[]):SyncRecord{
  const document=character();document.revision=1;
  return {schema:SYNC_SCHEMA,serverOrigin:'http://x',accountId:'u',characterId:'srv',confirmed:{id:'srv',ownerId:'u',system:'dnd5e',schemaVersion:1,revision:1,document,createdAt:'t',updatedAt:'t'},outbox,applied:[],updatedAt:'t'};
}
const pending=(operationId:string,operations:Operation[],extra:Partial<PendingEntry>={}):PendingEntry=>({operationId,clientId:'c',operations,status:'queued',everSent:false,authoredRevision:1,priorOperationIds:[],before:{},createdAt:'t',attempts:0,...extra});

describe('confirmed/pending bookkeeping',()=>{
  it('applies each revision once even when HTTP and WS both deliver it',()=>{
    const hp:Operation[]=[{op:'inc',path:'/runtime/hp',value:-5}];
    let r=record([pending('op-1',hp,{status:'sending',everSent:true})]);
    r=absorbResults(r,[result(2,'op-1',hp)]);
    r=absorbResults(r,[result(2,'op-1',hp)]);
    expect(r.confirmed.document.runtime.hp).toBe(15);expect(r.confirmed.revision).toBe(2);
    expect(r.confirmed.document.revision).toBe(2);expect(r.confirmed.document.updatedAt).toBe('2026-10-01T00:00:02Z');
    expect(r.outbox).toEqual([]);
  });
  it('does not settle a pending intent across a revision gap',()=>{
    const r=absorbResults(record([pending('op-3',[])]),[result(3,'op-3',[])]);
    expect(r.confirmed.revision).toBe(1);expect(r.outbox).toHaveLength(1);
    const filled=absorbResults(r,[result(3,'op-3',[]),result(2,'other',[{op:'set',path:'/name',value:'远端'}])]);
    expect(filled.confirmed.revision).toBe(3);expect(filled.confirmed.document.name).toBe('远端');expect(filled.outbox).toEqual([]);
  });
  it('places a queued intent after the own intents it was authored on, not after foreign ones',()=>{
    const r={...record(),confirmed:{...record().confirmed,revision:4},applied:[{revision:2,operationId:'mine-1'},{revision:3,operationId:'foreign'},{revision:4,operationId:'mine-2'}]};
    expect(baseRevisionFor(r,pending('x',[],{authoredRevision:1,priorOperationIds:['mine-1','mine-2']}))).toBe(2);
    expect(baseRevisionFor(r,pending('y',[],{authoredRevision:3,priorOperationIds:['mine-2']}))).toBe(4);
  });
  it('a reload turns in-flight requests into unknown results',()=>{
    const r=recoverRecord(record([pending('s',[],{status:'sending',everSent:true})]));
    expect(r.outbox[0].status).toBe('unknown');
  });
  it('flags never-sent offline intents whose edited values changed on the server',()=>{
    const c=character(),ops:Operation[]=[{op:'set',path:'/name',value:'离线名字'},{op:'inc',path:'/runtime/hp',value:-1}];
    const entry=pending('off',ops,{before:contextOf(c,ops)});
    expect(staleConflicts(entry,c)).toEqual([]);
    const server=structuredClone(c);server.name='服务器名字';server.runtime.hp=3;
    expect(staleConflicts(entry,server)).toEqual([{path:'/name',serverExists:true,serverValue:'服务器名字',clientValue:'离线名字'}]);
    const deleted=structuredClone(c);deleted.selections=[];
    const sel:Operation[]=[{op:'set',path:'/selections/entities/A/quantity',value:2}];
    expect(staleConflicts(pending('q',sel,{before:contextOf(c,sel)}),deleted)[0]).toMatchObject({serverExists:false});
  });
});
