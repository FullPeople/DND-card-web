import {describe,it,expect} from 'vitest';
import {capacityFormula,carrying} from '../src/core/carrying';
import {newCharacter,type Entry} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {sameStock,previewInventory,overlayInventory,applyInventory,type InventoryState} from '../src/core/inventory';
const entry:Entry={id:'item:a',name:'测试盔甲',english:'Armor',kind:'item',source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:[],raw:{ac:18,type:'HA',weight:2}};
function inventory():InventoryState{return {revision:1,publicId:'public',silent:false,containers:{public:{id:'public',kind:'public',name:'公共',write:true,revision:1,capacity:20,columns:4,items:[{id:'a',name:'测试',kind:'item',entry,quantity:6,slot:0,revision:1}]},hero:{id:'hero',kind:'card',name:'角色',write:true,revision:1,capacity:24,columns:4,items:[]}}};}
describe('capacity and display markers',()=>{
 it('uses size/Strength, supports shorthand and arithmetic without executable input',()=>{const c=newCharacter();c.abilities.str=12;c.size='L';expect(carrying(c,evaluate(c)).max).toBe(360);expect(capacityFormula('*2+力量',360,12)).toBe(732);expect(capacityFormula('(基础+30)/2',150,10)).toBe(90);expect(capacityFormula('-20',150,10)).toBe(130);for(const bad of ['1/0','window.alert(1)','基础.constructor','1e20','2**3','-500'])expect(()=>capacityFormula(bad,150,10)).toThrow();});
 it('equipment and attunement references do not change armor calculations',()=>{const c=newCharacter(),before=evaluate(c);c.selections.push({id:'a',entry,level:1,quantity:1,equipped:true,attuned:true});expect(evaluate(c).ac).toBe(before.ac);});
});
describe('optimistic stock projection',()=>{
 it('shows transfer immediately and reconciles the same operation without applying it twice',()=>{const before=inventory(),after=previewInventory(before,{action:'transfer',from:'public',to:'hero',rows:[{id:'a',quantity:3,newId:'received'}]});expect(after.containers.public.items[0].quantity).toBe(3);expect(after.containers.hero.items[0].quantity).toBe(3);expect(overlayInventory(after,before,after).containers).toEqual(after.containers);const server=structuredClone(before);server.containers.public.items.push({id:'b',name:'其他玩家物品',kind:'item',entry,quantity:1,revision:1,slot:1});expect(overlayInventory(server,before,after).containers.public.items.some(r=>r.id==='b')).toBe(true);});
 it('splits conserve total and never duplicate equip markers',()=>{const before=inventory();before.containers.public.items[0].attuned=true;const after=previewInventory(before,{action:'split',container:'public',id:'a',newId:'split',quantity:2,slot:7});expect(after.containers.public.items.map(r=>r.quantity)).toEqual([4,2]);expect(after.containers.public.items[1].slot).toBe(7);expect(after.containers.public.items[1].attuned).toBe(false);});
});

it('exact stack identity is canonical but does not ignore rules, names',()=>{const a=inventory().containers.public.items[0];expect(sameStock(a,{...a,id:'b',quantity:2,slot:2,revision:9,locked:false,entry:{...entry,raw:{weight:2,ac:18,type:'HA'}}})).toBe(true);for(const changed of [{name:'其他'}, {locked:true}, {entry:{...entry,source:'HOME'}}, {entry:{...entry,entries:['不同正文']}}])expect(sameStock(a,{...a,...changed})).toBe(false);});
it('optimistic merge and acknowledged overlay preserve one exact quantity',()=>{const before=inventory(),a=before.containers.public.items[0];before.containers.public.items.push({...a,id:'b',quantity:2,slot:7});const after=previewInventory(before,{action:'merge',container:'public',id:'b',targetId:'a'});expect(after.containers.public.items).toHaveLength(1);expect(after.containers.public.items[0].quantity).toBe(8);expect(overlayInventory(after,before,after).containers.public.items[0].quantity).toBe(8);});


// Authored background and equipment, independent of upstream source snapshots.
import {syncFeatures} from '../src/core/sheet';
import {readCharacter} from '../src/core/validation';
import {initializeAutomation} from '../src/core/automation/state';
import {sheetChoices,builtinOptionsVisible} from '../src/core/automation/choices';
import {sourceEquipmentReceipt} from '../src/core/automation/sourceEquipment';
function backgroundGift(){
 const c=newCharacter();const background:Entry={...entry,id:'background:test',kind:'background',name:'原创赠品背景',raw:{startingEquipment:[{_:['测试盔甲|XPHB']}]}};
 c.selections=[{id:'background',entry:background,level:1,quantity:1,equipped:false}];syncFeatures(c,[entry]);return c;
}
it.each(['remove','update'])('explicit gift %s remains dismissed through inventory projection, repeated sync and restore',action=>{
 const c=backgroundGift(),gift=c.selections.find(s=>s.entry.kind==='item')!;
 const state=inventory();state.containers.public.items=[{id:gift.id,name:gift.entry.name,entry:gift.entry,kind:'item',quantity:1,slot:0,revision:1}];
 const projected=previewInventory(state,action==='remove'?{action,container:'public',ids:[gift.id]}:{action,container:'public',id:gift.id,patch:{quantity:0}});
 applyInventory(c,projected.containers.public,[gift.id]);syncFeatures(c,[entry]);syncFeatures(c,[entry]);
 expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);expect(sourceEquipmentReceipt(c,c.selections[0])?.itemIds).toContain(gift.id);expect(sourceEquipmentReceipt(c,c.selections[0])?.completed).toBe(true);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;syncFeatures(restored,[entry]);expect(restored.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);
 applyInventory(restored,projected.containers.public,[gift.id]);expect(sourceEquipmentReceipt(restored,restored.selections[0])?.itemIds).toEqual([gift.id]);
});
it('a snapshot missing a delivered background gift does not invent a dismissal or replenish possessions',()=>{
 const c=backgroundGift(),state=inventory();state.containers.public.items=[];applyInventory(c,state.containers.public);
 expect(c.dismissedFeatures).toBeUndefined();syncFeatures(c,[entry]);expect(c.selections.filter(s=>s.entry.kind==='item')).toHaveLength(0);expect(sourceEquipmentReceipt(c,c.selections[0])?.completed).toBe(true);
});
it.each([false,true])('default automation preserves legacy background gifts and their dismissal state (%s)',dismissed=>{
 const c=backgroundGift(),gift=c.selections.find(s=>s.entry.kind==='item')!;
 // Simulate a pre-receipt backup with its original linked grant provenance.
 delete c.inventory!.sourceEquipment;gift.parentId='background';gift.grantKey='equipment:0:_:0';
 c.selections[0].entry=structuredClone(c.selections[0].entry);
 c.selections[0].entry.raw.startingEquipment[0]._.push({value:500});
 syncFeatures(c,[entry]);c.inventory!.coins.gp=2;gift.quantity=3;
 if(dismissed){c.dismissedFeatures=[`${gift.parentId}|${gift.grantKey}`];c.selections=c.selections.filter(s=>s.id!==gift.id);}
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;
 initializeAutomation(restored);for(let i=0;i<3;i++)syncFeatures(restored,[entry]);
 expect(restored.inventory!.coins.gp).toBe(2);
 expect(restored.selections.filter(s=>s.entry.kind==='item').map(s=>[s.id,s.quantity])).toEqual(dismissed?[]:[[gift.id,3]]);
 expect(sheetChoices(restored).filter(r=>r.channel==='equipment')).toHaveLength(1);expect(sheetChoices(restored).find(r=>r.channel==='equipment')?.complete).toBe(true);expect(builtinOptionsVisible(restored,'background')).toBe(false);
});
