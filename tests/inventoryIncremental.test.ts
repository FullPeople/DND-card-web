import {expect,it,vi} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {applyInventory,previewInventory,sameStock,type InventoryState,type Stock} from '../src/core/inventory';

const entry=(id:string):Entry=>({id,kind:'item',name:id,english:id,edition:'2024',source:'XPHB',revision:'1',packId:'authored',entries:['Authored regression content'],raw:{weight:1,future:{keep:id}}});
const stock=(id:string,slot:number):Stock=>({id,kind:'item',name:id,entry:entry(id),quantity:2,slot,revision:1,equipped:false,attuned:false});
function state():InventoryState{return {revision:1,publicId:'public',silent:false,containers:{a:{id:'a',name:'A',kind:'card',revision:1,columns:5,capacity:25,write:true,items:[stock('one',0),stock('two',1)]},b:{id:'b',name:'B',kind:'public',revision:1,columns:5,capacity:25,write:true,items:[stock('other',0)]}}};}
it('moving one row preserves all other rows, source snapshots and containers without deep cloning',()=>{
 const original=state(),before=JSON.stringify(original),clone=vi.spyOn(globalThis,'structuredClone');
 try{const next=previewInventory(original,{action:'move',container:'a',positions:[{id:'one',slot:4}]});
 expect(next.containers.a.items[0].slot).toBe(4);expect(JSON.stringify(original)).toBe(before);
 expect(next.containers.a.items[0]).not.toBe(original.containers.a.items[0]);expect(next.containers.a.items[0].entry).toBe(original.containers.a.items[0].entry);
 expect(next.containers.a.items[1]).toBe(original.containers.a.items[1]);expect(next.containers.b).toBe(original.containers.b);expect(clone).not.toHaveBeenCalled();}finally{clone.mockRestore();}
});
it('a distinct add computes the incoming stack identity once and preserves existing rows',()=>{
 const original=state();original.containers.a.items=Array.from({length:50},(_,i)=>stock('owned-'+i,i));const added=stock('new',0),stringify=vi.spyOn(JSON,'stringify');
 try{const next=previewInventory(original,{action:'add',container:'a',row:added});expect(next.containers.a.items).toHaveLength(51);expect(stringify).toHaveBeenCalledTimes(51);for(let i=0;i<50;i++)expect(next.containers.a.items[i]).toBe(original.containers.a.items[i]);}finally{stringify.mockRestore();}
});
it('stack comparison still reads mutable snapshots and separates source/rule/unknown differences',()=>{
 const a=stock('same',0),b=structuredClone(a);expect(sameStock(a,b)).toBe(true);b.entry!.raw.future.keep='changed';expect(sameStock(a,b)).toBe(false);b.entry=structuredClone(a.entry!);b.entry!.source='PHB';expect(sameStock(a,b)).toBe(false);
});
function card(){const c=newCharacter();c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:7,pp:0},positions:{one:5,two:6,'future-hidden':77}};c.selections=[{id:'one',entry:entry('one'),level:1,quantity:2,equipped:false},{id:'feature',entry:{...entry('feature'),kind:'feature'},level:1,quantity:1,equipped:false},{id:'two',entry:entry('two'),level:4,quantity:2,equipped:false}];c.runtime.resources.manual={name:'Authored spent resource',max:9,current:2};(c as any).opaque={preserve:true};return c;}
it('applying a quantity change preserves unmodified selection order, snapshots, levels and opaque inventory state',()=>{
 const c=card(),prior=[...c.selections],coins=c.inventory!.coins,resource=c.runtime.resources.manual;
 const money:Stock={id:'coin:gp',kind:'currency',coin:'gp',name:'gp',quantity:7,slot:3,revision:1};
 applyInventory(c,{id:'local',kind:'card',name:'local',revision:2,columns:5,capacity:25,write:true,items:[money,{...stock('one',5),entry:prior[0].entry},{...stock('two',6),entry:prior[2].entry,quantity:3}]});
 expect(c.selections.map(r=>r.id)).toEqual(['one','feature','two']);expect(c.selections[0]).toBe(prior[0]);expect(c.selections[1]).toBe(prior[1]);expect(c.selections[2].entry).toBe(prior[2].entry);expect(c.selections[2].level).toBe(4);expect(c.selections[2].quantity).toBe(3);
 expect(c.inventory!.coins).toBe(coins);expect(c.inventory!.positions!['future-hidden']).toBeUndefined();expect(c.runtime.resources.manual).toBe(resource);expect((c as any).opaque).toEqual({preserve:true});
});
it('complete stock membership removes transferred possessions without changing unrelated rows or manual resources',()=>{
 const c=card(),two=c.selections[2];applyInventory(c,{id:'local',kind:'card',name:'local',revision:2,columns:5,capacity:25,write:true,items:[{...stock('two',6),entry:two.entry}]});expect(c.selections.some(r=>r.id==='one')).toBe(false);expect(c.selections.find(r=>r.id==='two')).toBe(two);expect(c.inventory!.coins.gp).toBe(0);expect(c.runtime.resources.manual.current).toBe(2);
});
