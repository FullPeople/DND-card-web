// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Character} from '../src/core/model';
import {itemChargeFixture,itemChargeSnapshot} from './helpers/itemChargeDebitFixture';
import {itemChargeOffers} from '../src/core/automation/itemChargeDebits';
import {equipSelection} from '../src/core/automation/equipment';
import {syncAutoResources} from '../src/core/resources';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {localGm} from '../src/cloud/localRights';
import {evaluate} from '../src/core/engine';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});

/** Actual normalized physical source, React controls and real actor/sync/native
 * APIs. The host transaction and save-status boundary is authored, not App or
 * backend acceptance; no role/session/actor behavior is replaced. */
async function setup(){
 await dispose?.();const source=itemChargeFixture();let c=source.c,writable=true,active=true,defer=false,submit=true,editor=false,saveLabel='已保存到本机',pending:((draft:Character)=>void)|undefined;
 const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);syncAutoResources(draft);c=draft;draw();});
 function draw(){const offer=itemChargeOffers(c)[0];root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement('main',null,createElement(AutomationPanel,{c,d:evaluate(c),entries:source.entries,edit,writable}),editor&&offer&&createElement(ResourceModuleEditor,{c,id:offer.key,edit,close:()=>{},disabled:!writable,gm:localGm()}))))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const button=(name:string)=>{const rows=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(row=>row.textContent===name||row.getAttribute('aria-label')===name);expect(rows,`one authored control ${name}`).toHaveLength(1);return rows[0];};
 const fill=async(value:string)=>act(()=>{const node=field('物品充能当前已知剩余');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const acquire=async(value:string)=>{await fill(value);await click(field('确认本次物品是真实物理实例'));await click(field('确认物品当前充能已核对'));await click(button('确认记录物品充能'));};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();
 return{source,host,field,button,fill,click,acquire,render,unmount,edit,get c(){return c;},get pending(){return pending;},get offer(){return itemChargeOffers(c)[0];},set writable(v:boolean){writable=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set editor(v:boolean){editor=v;},set saveLabel(v:string){saveLabel=v;}};
}
it('blank explicit known balance includes zero; an actual equipped fixed1 route debits once, exhausts and survives native reopening without effects or refill',async()=>{
 const zero=await setup();expect(zero.field('物品充能当前已知剩余').value).toBe('');expect(zero.button('确认记录物品充能').disabled).toBe(true);await zero.fill('1');await zero.click(zero.field('确认物品当前充能已核对'));expect(zero.field('确认物品当前充能已核对').checked).toBe(true);await zero.fill('0');expect(zero.field('确认物品当前充能已核对').checked).toBe(false);await zero.acquire('0');expect(zero.offer.remaining).toBe(0);expect(zero.button('记录固定费用分支 · 扣 1 充能').disabled).toBe(true);expect(zero.button('确认记录物品充能').disabled).toBe(true);
 const s=await setup(),manual=itemChargeSnapshot(s.c.runtime.resources.manual);await s.acquire('1');expect(s.button('记录固定费用分支 · 扣 1 充能').disabled).toBe(true);equipSelection(s.c,s.source.owner.id,true);await s.render();expect(s.button('记录固定费用分支 · 扣 1 充能').disabled).toBe(false);await s.click(s.button('记录固定费用分支 · 扣 1 充能'));expect(s.offer.remaining).toBe(0);expect(s.c.runtime.itemChargeDebits?.sequence).toBe(2);await s.click(s.button('记录固定费用分支 · 扣 1 充能'));expect(s.c.runtime.itemChargeDebits?.sequence).toBe(2);const reopened=readCharacter(exportCharacter(s.c)).character;syncAutoResources(reopened);expect(reopened.runtime.resources[s.offer.key].current).toBe(0);expect(itemChargeSnapshot(reopened.runtime.itemChargeDebits)).toBe(itemChargeSnapshot(s.c.runtime.itemChargeDebits));expect(itemChargeSnapshot(reopened.runtime.resources.manual)).toBe(manual);expect(s.host.textContent).toContain('不执行物品动作、施法或效果');expect([...s.host.querySelectorAll('button')].some(node=>/^恢复/.test(node.textContent||''))).toBe(false);
});
it('cancel, readonly, retained hide, unmount, card and source changes invalidate a deferred acquisition; repeated callback cannot regrant',async()=>{
 for(const mode of ['cancel','readonly','hide','unmount','card','source','apply'] as const){const s=await setup();s.defer=true;await s.acquire('1');await s.click(s.button('确认记录物品充能'));expect(s.edit).toHaveBeenCalledTimes(1);const pending=s.pending!;if(mode==='cancel')await s.click(s.button('取消物品充能核对'));else if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else if(mode==='unmount')await s.unmount();const draft=structuredClone(s.c);if(mode==='card')draft.id='authored-other-card';if(mode==='source')draft.profile.enabledSources=[];const before=itemChargeSnapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(draft.runtime.itemChargeDebits?.records).toHaveLength(1);const once=itemChargeSnapshot(draft);await act(()=>pending(draft));expect(itemChargeSnapshot(draft)).toBe(once);}else expect(itemChargeSnapshot(draft)).toBe(before);}
});
it('owned generic numeric controls stay readonly after marker loss while an unrelated exact-key marker collision remains editable',async()=>{
 const s=await setup();await s.acquire('2');delete s.c.runtime.resources[s.offer.key].itemChargeDebitGrant;s.editor=true;await s.render();expect(s.field('资源剩余').readOnly).toBe(true);expect(s.field('资源上限').disabled).toBe(true);expect([...s.host.querySelectorAll('button')].some(node=>node.textContent==='移除')).toBe(false);
 const manual=await setup();manual.c.runtime.resources[manual.offer.key]={name:'Authored independent manual collision',max:7,current:2,itemChargeDebitGrant:{key:manual.offer.key}};manual.editor=true;await manual.render();expect(manual.field('资源剩余').readOnly).toBe(false);expect(manual.c.runtime.itemChargeDebits).toBeUndefined();expect(manual.button('确认记录物品充能').disabled).toBe(true);
});
it('observed ledger acknowledgement uses the real scoped save caption; rejected hosts and paused/withdrawn records never claim a fresh grant',async()=>{
 const s=await setup();s.saveLabel='保存失败：authored failure';await s.acquire('1');expect(s.host.querySelector('[data-testid=item-charge-save-state]')?.textContent).toBe('保存失败：authored failure');s.c.profile.enabledSources=[];await s.render();expect(s.offer.remaining).toBe(1);expect(s.button('记录固定费用分支 · 扣 1 充能').disabled).toBe(true);await s.click(s.button('撤销此物品充能记账'));expect(s.offer.withdrawn).toBe(true);expect(s.offer.remaining).toBe(1);expect(s.button('确认记录物品充能').disabled).toBe(true);
 const rejected=await setup();rejected.submit=false;const before=itemChargeSnapshot(rejected.c);await rejected.acquire('1');expect(itemChargeSnapshot(rejected.c)).toBe(before);expect(rejected.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();
 const opaque=await setup();opaque.defer=true;await opaque.acquire('1');const uncommitted=structuredClone(opaque.c);await act(()=>opaque.pending!(uncommitted));expect(uncommitted.runtime.itemChargeDebits?.last).toBeDefined();(opaque.c.runtime as any).itemChargeDebits={version:9,last:structuredClone(uncommitted.runtime.itemChargeDebits!.last),opaque:{keep:true}};await opaque.render();expect(opaque.host.querySelector('[data-item-charge-phase=applied]')).toBeNull();
});
