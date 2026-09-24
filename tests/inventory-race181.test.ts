import {expect,it} from 'vitest';
import {applyInventory,overlayInventory,previewInventory,type InventoryState} from '../src/core/inventory';
import {newCharacter} from '../src/core/model';
const initial=():InventoryState=>({revision:1,publicId:'public',silent:false,containers:{public:{id:'public',name:'公共仓库',kind:'public',write:true,columns:4,capacity:20,revision:1,items:[{id:'a',kind:'currency',coin:'gp',name:'金币',quantity:6,slot:0,revision:1},{id:'b',kind:'currency',coin:'sp',name:'银币',quantity:3,slot:1,revision:1}]}}});
it('two rapid slot drafts preserve live same-row quantity and lock changes without fabricating authoritative revisions',()=>{
 const original=initial(),first=previewInventory(original,{action:'move',container:'public',positions:[{id:'a',slot:5}]}),second=previewInventory(first,{action:'move',container:'public',positions:[{id:'a',slot:8}]});
 const remote=initial();remote.revision=2;remote.containers.public.revision=2;Object.assign(remote.containers.public.items[0],{quantity:11,locked:true,revision:2});remote.containers.public.items[1].quantity=7;
 const visible=overlayInventory(overlayInventory(remote,original,first),first,second);
 expect(visible.containers.public.items[0]).toMatchObject({id:'a',slot:8,quantity:11,locked:true,revision:2});expect(visible.containers.public.items[1].quantity).toBe(7);expect(visible.containers.public.revision).toBe(2);
 const firstAck=structuredClone(remote);firstAck.revision=3;firstAck.containers.public.revision=3;firstAck.containers.public.items[0].slot=5;
 expect(overlayInventory(firstAck,first,second).containers.public.items[0]).toMatchObject({slot:8,quantity:11,locked:true});
 expect(original.containers.public.items[0].slot).toBe(0);
});
it('a pending move never resurrects a row deleted or transferred remotely',()=>{
 const before=initial(),after=previewInventory(before,{action:'move',container:'public',positions:[{id:'a',slot:5}]}),remote=initial();remote.containers.public.items=remote.containers.public.items.filter(row=>row.id!=='a');
 expect(overlayInventory(remote,before,after).containers.public.items.map(row=>row.id)).toEqual(['b']);
});
it('unchanged stock rows retain their identity and imported native positions reflect the authoritative ledger',()=>{
 const before=initial(),after=previewInventory(before,{action:'move',container:'public',positions:[{id:'a',slot:6}]}),shown=overlayInventory(before,before,after);
 expect(shown.containers.public.items[1]).toBe(before.containers.public.items[1]);expect(shown.containers.public.revision).toBe(1);
 const c=newCharacter();applyInventory(c,shown.containers.public);expect(c.inventory?.positions).toEqual({a:6,b:1});expect(c.inventory?.coins.gp).toBe(6);
});
