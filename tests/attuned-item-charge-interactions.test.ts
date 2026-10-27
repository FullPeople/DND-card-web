// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Character} from '../src/core/model';
import {ItemChargeUseControl} from '../src/ui/ItemChargeUseControl';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {attunedItemChargeFixture,attunedItemChargeSnapshot} from './helpers/attunedItemChargeDebitFixture';
import {itemChargeOffers} from '../src/core/automation/itemChargeDebits';
import {containerFor} from '../src/ui/InventoryPage';
import {applyInventory,previewInventory} from '../src/core/inventory';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
/** Real authenticated source, inventory command and leaf events. The authored
 * host models a deferred transaction, not mounted App/backend/room acceptance.
 * It never writes a saved role, replaces actor behavior or invents attunement. */
async function setup(english='Wand of Enemy Detection'){
 await dispose?.();const f=attunedItemChargeFixture(english);let c=f.c,writable=true,defer=false,pending:((draft:Character)=>void)|undefined;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){root?.render(createElement(RetainedCardVisibility.Provider,{value:true},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(ItemChargeUseControl,{c,ownerId:f.owner.id,edit,writable}))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const button=(name:string)=>{const rows=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===name);expect(rows).toHaveLength(1);return rows[0];};
 const fill=async(value:string)=>act(()=>{const node=field('物品充能当前已知剩余');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const marks=async(equipped:boolean,attuned:boolean)=>{const container=containerFor(c),next=previewInventory({revision:1,publicId:'',silent:false,containers:{[container.id]:container}},{action:'update',container:container.id,id:f.owner.id,patch:{equipped,attuned}});applyInventory(c,next.containers[container.id]);await render();};
 const acquire=async()=>{await fill('2');await click(field('确认本次物品是真实物理实例'));await click(field('确认物品当前充能已核对'));await click(button('确认记录物品充能'));};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,field,button,click,marks,acquire,render,get c(){return c;},get offer(){return itemChargeOffers(c)[0];},get pending(){return pending;},set defer(v:boolean){defer=v;},set writable(v:boolean){writable=v;}};
}
it('real wand controls use both current inventory marks before explicit known2, debit exactly1 and keep nonterminal/spent/native state on attunement loss',async()=>{
 const s=await setup(),manual=attunedItemChargeSnapshot([s.c.runtime.resources.manual,s.c.runtime.hp,s.c.notes]);expect(s.field('物品充能当前已知剩余').value).toBe('');expect(s.field('物品充能当前已知剩余').disabled).toBe(true);await s.marks(true,false);expect(s.field('物品充能当前已知剩余').disabled).toBe(true);await s.marks(true,true);expect(s.field('物品充能当前已知剩余').disabled).toBe(false);expect(s.host.textContent).toContain('实际装备／同调程序、限制和效果仍须人工核对');await s.acquire();expect(s.offer.remaining).toBe(2);await s.click(s.button('记录固定费用分支 · 扣 1 充能'));expect(s.offer.remaining).toBe(1);expect(s.c.runtime.itemChargeDebits?.sequence).toBe(2);expect(s.button('记录固定费用分支 · 扣 1 充能').disabled).toBe(true);
 const history=attunedItemChargeSnapshot(s.c.runtime.itemChargeDebits);await s.marks(true,false);expect(s.offer.eligible).toBe(false);expect(s.offer.remaining).toBe(1);expect(attunedItemChargeSnapshot(s.c.runtime.itemChargeDebits)).toBe(history);const reopened=readCharacter(exportCharacter(s.c)).character;expect(attunedItemChargeSnapshot(reopened.runtime.itemChargeDebits)).toBe(history);expect(attunedItemChargeSnapshot([reopened.runtime.resources.manual,reopened.runtime.hp,reopened.notes])).toBe(manual);expect(s.host.textContent).toContain('末次耗尽分支尚未支持');
});
it('loss of current attunement or readonly before a deferred leaf transaction rejects without any Character write',async()=>{
 for(const mode of ['attunement','readonly'] as const){const s=await setup('Wand of Fear');await s.marks(true,true);if(mode==='readonly')await s.acquire();s.defer=true;if(mode==='attunement')await s.acquire();else await s.click(s.button('记录固定费用分支 · 扣 1 充能'));expect(s.pending).toBeDefined();if(mode==='attunement')await s.marks(true,false);else{s.writable=false;await s.render();}const draft=structuredClone(s.c),before=attunedItemChargeSnapshot(draft);await act(()=>s.pending!(draft));expect(attunedItemChargeSnapshot(draft)).toBe(before);expect(s.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();}
});
