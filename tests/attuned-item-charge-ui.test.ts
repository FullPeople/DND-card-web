import {it,expect,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:vi.fn(),landingWithin:vi.fn()}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ItemChargeUseControl} from '../src/ui/ItemChargeUseControl';
import {attunedItemChargeFixture,attunedItemChargeSnapshot} from './helpers/attunedItemChargeDebitFixture';
import {itemChargeOffers} from '../src/core/automation/itemChargeDebits';
const render=(f:ReturnType<typeof attunedItemChargeFixture>,writable=true)=>renderToStaticMarkup(createElement(ItemChargeUseControl,{c:f.c,ownerId:f.owner.id,edit:()=>{},writable}));
it('the actual admitted wand shows both existing inventory marks and manual attunement procedure before any balance or free grant',()=>{
 const f=attunedItemChargeFixture(),before=attunedItemChargeSnapshot(f.c),offer=itemChargeOffers(f.c)[0],html=render(f);
 expect(f.entry.raw.reqAttune).toBe(true);expect(offer.requiresAttunement).toBe(true);expect(offer.canAcquire).toBe(false);
 expect(html).toContain('先在背包中记录当前已装备且已同调');expect(html).toContain('实际装备／同调程序、限制和效果仍须人工核对');expect(html).toContain('不会自动装备或同调');
 expect(html.match(/<input[^>]*aria-label="物品充能当前已知剩余"[^>]*>/)?.[0]).toContain('value=""');expect(f.c.runtime.itemChargeDebits).toBeUndefined();expect(attunedItemChargeSnapshot(f.c)).toBe(before);
});
import {containerFor} from '../src/ui/InventoryPage';
import {applyInventory,previewInventory} from '../src/core/inventory';
import {itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {itemChargeFixture} from './helpers/itemChargeDebitFixture';
const remainingInput=(html:string)=>html.match(/<input[^>]*aria-label="物品充能当前已知剩余"[^>]*>/)?.[0]||'';
const debitButton=(html:string)=>html.match(/<button[^>]*>记录固定费用分支 · 扣 1 充能<\/button>/)?.[0]||'';
function marks(f:ReturnType<typeof attunedItemChargeFixture>,equipped:boolean,attuned:boolean){const container=containerFor(f.c),next=previewInventory({revision:1,publicId:'',silent:false,containers:{[container.id]:container}},{action:'update',container:container.id,id:f.owner.id,patch:{equipped,attuned}});applyInventory(f.c,next.containers[container.id]);}
it('both real wands require both literal current inventory marks, keep explicit known2 to1 history across mark loss/native reopen, and never support the terminal branch',()=>{
 for(const english of ['Wand of Enemy Detection','Wand of Fear']){
  const f=attunedItemChargeFixture(english),manual=attunedItemChargeSnapshot([f.c.runtime.resources.manual,f.c.runtime.hp,f.c.notes]);
  for(const [equipped,attuned]of [[false,false],[true,false],[false,true]]){marks(f,equipped,attuned);const before=attunedItemChargeSnapshot(f.c),offer=itemChargeOffers(f.c)[0];expect(offer.canAcquire).toBe(false);expect(remainingInput(render(f))).toContain('disabled');expect(attunedItemChargeSnapshot(f.c)).toBe(before);}
  marks(f,true,true);let offer=itemChargeOffers(f.c)[0];expect(offer.canAcquire).toBe(true);expect(remainingInput(render(f))).not.toContain('disabled');expect(remainingInput(render(f))).toContain('value=""');expect(render(f)).toContain('先在背包中记录当前已装备且已同调');
  expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'ui-attuned-known2',{kind:'acquire',knownRemaining:2,confirmedGenuineItem:true,confirmedKnownBalance:true})).status).toBe('applied');offer=itemChargeOffers(f.c)[0];expect(debitButton(render(f))).not.toContain('disabled');
  const debit=itemChargeRequest(f.c,f.owner.id,'ui-attuned-fixed1',{kind:'debit',actionKey:offer.actionKey!});expect(performItemChargeAction(f.c,debit).status).toBe('applied');expect(performItemChargeAction(f.c,debit).status).toBe('duplicate');expect(itemChargeOffers(f.c)[0].remaining).toBe(1);expect(debitButton(render(f))).toContain('disabled');expect(render(f)).toContain('必须至少保留 1');
  const history=attunedItemChargeSnapshot(f.c.runtime.itemChargeDebits);for(const [equipped,attuned]of [[true,false],[false,true]]){marks(f,equipped,attuned);expect(itemChargeOffers(f.c)[0].eligible).toBe(false);expect(render(f)).toContain('当前已记录剩余 1 / 7');expect(attunedItemChargeSnapshot(f.c.runtime.itemChargeDebits)).toBe(history);}
  f.c=readCharacter(exportCharacter(f.c)).character;expect(itemChargeOffers(f.c)[0].remaining).toBe(1);expect(attunedItemChargeSnapshot(f.c.runtime.itemChargeDebits)).toBe(history);expect(attunedItemChargeSnapshot([f.c.runtime.resources.manual,f.c.runtime.hp,f.c.notes])).toBe(manual);expect(render(f)).toContain('不执行物品动作、施法或效果');expect(render(f)).not.toMatch(/>恢复[^<]*<\/button>/);
 }
});
it('readonly dominates current attunement and explicit known-balance confirmations without any Character write',()=>{
 const f=attunedItemChargeFixture();marks(f,true,true);const before=attunedItemChargeSnapshot(f.c),html=render(f,false);expect(html.match(/<fieldset[^>]*>/)?.[0]).toContain('disabled');expect(html).toContain('先在背包中记录当前已装备且已同调');const q=itemChargeRequest(f.c,f.owner.id,'ui-attuned-readonly',{kind:'acquire',knownRemaining:2,confirmedGenuineItem:true,confirmedKnownBalance:true});expect(performItemChargeAction(f.c,q,{canEdit:false,gm:true}).status).toBe('rejected');expect(attunedItemChargeSnapshot(f.c)).toBe(before);
});
it('the old admitted nonattuned route keeps its existing equipment-only copy without inventing an attunement requirement',()=>{
 const f=itemChargeFixture(),html=renderToStaticMarkup(createElement(ItemChargeUseControl,{c:f.c,ownerId:f.owner.id,edit:()=>{}}));expect(itemChargeOffers(f.c)[0].canAcquire).toBe(true);expect(itemChargeOffers(f.c)[0].requiresAttunement).not.toBe(true);expect(html).toContain('此记账分支要求已标记装备');expect(html).not.toContain('先在背包中记录当前已装备且已同调');
});
