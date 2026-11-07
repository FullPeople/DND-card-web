// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it as privateSourceIt,vi} from 'vitest';
import {SlotBalanceRecoveryControl} from '../src/ui/SlotBalanceRecoveryControl';
import {ResourceModuleEditor} from '../src/ui/ResourceModuleEditor';
import {ResourceModuleFace} from '../src/ui/ResourceModuleFace';
import {ResourceRow} from '../src/ui/ResourceRow';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import type {Character} from '../src/core/model';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined,index=0;
function it(name:string,run:()=>unknown){const n=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(n,run));}
afterEach(async()=>{await dispose?.();dispose=undefined;vi.useRealTimers();});
async function setup(){
 await dispose?.();let c=slotBalanceRecoveryFixture().c,writable=true,active=true,defer=false,submit=true,saveLabel='正在保存';
 let pending:((draft:Character)=>void)|undefined,root:Root|undefined;
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const edit=vi.fn((action:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=action;return;}const draft=structuredClone(c);action(draft);c=draft;draw();});
 function draw(){root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement(SlotBalanceRecoveryControl,{c,edit,writable})))));}
 const render=async()=>{c={...c};await act(draw);};
 const input=()=>host.querySelector<HTMLInputElement>('input[aria-label="2环法术位剩余次数"]')!;
 const button=()=>host.querySelector<HTMLButtonElement>('button[aria-label="确认2环法术位余量"]')!;
 const fill=async(text:string)=>act(()=>{const node=input();expect(node).not.toBeNull();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,text);node.dispatchEvent(new Event('input',{bubbles:true}));});
 const click=async(node:HTMLElement)=>act(()=>node.click());
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};
 dispose=async()=>{await unmount();host.remove();};await render();
 return{host,edit,render,input,button,fill,click,unmount,get c(){return c;},replace:(next:Character)=>{c=next;},get pending(){return pending;},set writable(v:boolean){writable=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set saveLabel(v:string){saveLabel=v;}};
}
it('the actual control starts blank, accepts explicit zero once and reflects the observed native receipt and honest save state',async()=>{
 const s=await setup(),manual=structuredClone(s.c.runtime.resources.manual);expect(s.input().value).toBe('');expect(s.button().disabled).toBe(true);
 await s.fill('0');expect(s.button().disabled).toBe(false);await act(()=>{s.button().click();s.button()?.click();});
 expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.runtime.resources['spell-slot:2'].current).toBe(0);expect(s.host.querySelector('[data-phase="applied"]')).not.toBeNull();expect(s.host.textContent).toContain('正在保存');expect(s.host.textContent).not.toContain('已保存到本机');
 s.saveLabel='保存失败：authored failure';await s.render();expect(s.host.textContent).toContain('保存失败：authored failure');expect(s.c.runtime.resources.manual).toEqual(manual);
 const restored=readCharacter(exportCharacter(s.c)).character;expect(restored.runtime.resources['spell-slot:2'].current).toBe(0);expect(restored.runtime.slotCapacityReview).toEqual(s.c.runtime.slotCapacityReview);
});
it('empty, negative, fractional and over-capacity values never submit',async()=>{
 const s=await setup(),before=structuredClone(s.c);for(const value of ['', '-1','0.5','3']){await s.fill(value);expect(s.button().disabled).toBe(true);await s.click(s.button());expect(s.c).toEqual(before);}expect(s.edit).not.toHaveBeenCalled();
});
it('deferred callbacks cannot outlive readonly, retained hide, cancellation, card switch, source change or unmount',async()=>{
 for(const mode of ['readonly','hide','cancel','card','source','unmount'] as const){const s=await setup();await s.fill('1');s.defer=true;await s.click(s.button());const pending=s.pending!;expect(typeof pending).toBe('function');
  if(mode==='readonly'){s.writable=false;await s.render();s.writable=true;await s.render();}if(mode==='hide'){s.active=false;await s.render();}if(mode==='cancel'){const cancel=[...s.host.querySelectorAll('button')].find(b=>b.textContent==='取消确认')!;await s.click(cancel);}if(mode==='card'){const next=structuredClone(s.c);next.id='authored-other-card';s.replace(next);await s.render();}if(mode==='source'){s.c.profile.enabledSources=[];await s.render();}if(mode==='unmount')await s.unmount();
  const draft=structuredClone(s.c),before=structuredClone(draft);await act(()=>pending(draft));expect(draft).toEqual(before);
 }
});
it('same-frame repeats queue once and replaying the exact delivered callback cannot write twice',async()=>{
 const s=await setup();await s.fill('1');s.defer=true;await act(()=>{s.button().click();s.button().click();});expect(s.edit).toHaveBeenCalledTimes(1);const draft=structuredClone(s.c),pending=s.pending!;
 await act(()=>pending(draft));expect(draft.runtime.resources['spell-slot:2'].current).toBe(1);const once=structuredClone(draft);await act(()=>pending(draft));expect(draft).toEqual(once);
});
it('a rejected host edit never claims receipt or persistence, and can be cancelled after the wait notice',async()=>{
 vi.useFakeTimers();const s=await setup();s.submit=false;const before=structuredClone(s.c);await s.fill('0');await s.click(s.button());expect(s.c).toEqual(before);expect(s.host.querySelector('[data-phase="applied"]')).toBeNull();
 await act(()=>vi.advanceTimersByTime(4500));expect(s.host.textContent).toContain('尚未收到卡面确认');expect(s.host.textContent).not.toContain('已保存到本机');const cancel=[...s.host.querySelectorAll('button')].find(b=>b.textContent==='取消确认')!;await s.click(cancel);expect(s.c).toEqual(before);
});
it('unrelated card updates preserve a typed balance while a capacity change clears it for a fresh confirmation',async()=>{
 const s=await setup();await s.fill('1');s.c.notes='Authored unrelated edit';s.c.revision++;await s.render();expect(s.input().value).toBe('1');
 (s.c.runtime.slotCapacityReview as any).pending['spell-slot:2'].max=3;await s.render();expect(s.input().value).toBe('');expect(s.button().disabled).toBe(true);
});
it('an occupied manual counter stays intact and the actual form cannot submit through readonly or GM defaults',async()=>{
 const s=await setup();s.c.runtime.resources['spell-slot:2']={name:'Authored manual collision',max:9,current:2};await s.render();const before=structuredClone(s.c);expect(s.input().disabled).toBe(true);expect(s.button().disabled).toBe(true);await s.click(s.button());expect(s.c).toEqual(before);expect(s.edit).not.toHaveBeenCalled();
});
it('the real resource settings form can change a known ordinary balance without tripping its own ledger hold',async()=>{
 const s=await setup();await s.fill('0');await s.click(s.button());const key='spell-slot:2',host=document.createElement('div');document.body.append(host);const root=createRoot(host),close=vi.fn();
 try{
  await act(()=>root.render(createElement(ResourceModuleEditor,{c:s.c,id:key,disabled:false,gm:false,close,edit:(fn:(c:Character)=>void)=>{const next=structuredClone(s.c);fn(next);s.replace(next);}})));
  const input=host.querySelector<HTMLInputElement>('input[aria-label="资源剩余"]')!;expect(input).not.toBeNull();
  await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'1');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  expect(close).toHaveBeenCalledTimes(1);expect(s.c.runtime.resources[key].current).toBe(1);expect(s.c.spellSettings!.slots['2']).toEqual({max:2,used:1});expect((s.c.runtime.slotCapacityReview as any).balances[key]).toEqual({spent:1,max:2,current:1});
 }finally{await act(()=>root.unmount());host.remove();}
});
it('the actual resource settings form lets the live GM unlock a pending automatic pool without changing or confirming its balance',async()=>{
 const s=await setup(),key='spell-slot:2';s.c.runtime.resources[key]={name:'Authored pending locked pool',max:3,current:1,automatic:true,locked:true};s.c.spellSettings!.slots['2']={max:3,used:2};const before=structuredClone(s.c),host=document.createElement('div');document.body.append(host);const root=createRoot(host),close=vi.fn();
 try{
  await act(()=>root.render(createElement(ResourceModuleEditor,{c:s.c,id:key,disabled:false,gm:true,close,edit:(fn:(c:Character)=>void)=>{const next=structuredClone(s.c);fn(next);s.replace(next);}})));
  const unlock=host.querySelector<HTMLButtonElement>('button[aria-label="解锁资源"]')!;expect(unlock.disabled).toBe(false);await act(()=>unlock.click());
  await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  expect(close).toHaveBeenCalledTimes(1);expect(s.c.runtime.resources[key]).toEqual({...before.runtime.resources[key],locked:false});expect(s.c.runtime.slotCapacityReview).toEqual(before.runtime.slotCapacityReview);expect(s.c.spellSettings).toEqual(before.spellSettings);expect(s.c.runtime.resources.manual).toEqual(before.runtime.resources.manual);
 }finally{await act(()=>root.unmount());host.remove();}
});
it('recounting an existing automatic balance requires the visible acknowledgement, preserves its style and clears that acknowledgement on a changed record',async()=>{
 const s=await setup(),key='spell-slot:2';s.c.runtime.resources[key]={name:'Authored existing automatic style',max:3,current:1,automatic:true,type:'bar',icon:'bottle'};s.c.spellSettings!.slots['2']={max:3,used:2};await s.render();
 const check=()=>s.host.querySelector<HTMLInputElement>('input[aria-label="已核对2环已有法术位记录"]')!;expect(check()).not.toBeNull();expect(s.input().disabled).toBe(true);await s.click(check());expect(s.input().disabled).toBe(false);
 s.c.runtime.resources[key].current=2;s.c.spellSettings!.slots['2'].used=1;await s.render();expect(check().checked).toBe(false);expect(s.input().disabled).toBe(true);
 await s.click(check());await s.fill('0');await s.click(s.button());expect(s.c.runtime.resources[key]).toEqual({name:'Authored existing automatic style',max:2,current:0,automatic:true,type:'bar',icon:'bottle'});expect(s.c.spellSettings!.slots['2']).toEqual({max:2,used:2});expect(s.host.querySelector('[data-phase="applied"]')).not.toBeNull();
});
it('a held slot face shows pending review alongside the other known pool, without presenting stale counts as available units',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),key='spell-slot:2';
 try{
  await act(()=>root.render(createElement(ResourceModuleFace,{module:{id:'spell-slot:1',name:'Authored slot group',slots:true,rows:[['spell-slot:1',{max:4,current:2}],[key,{max:2,current:1}]]},style:'pool',held:new Set([key])} as any)));
  const held=host.querySelector(`[data-subresource-id="${key}"]`)!;expect(held.textContent).toContain('待核对');expect(held.getAttribute('data-resource-current')).toBeNull();expect(host.querySelector('[data-subresource-id="spell-slot:1"]')!.getAttribute('data-resource-current')).toBe('2');
 }finally{await act(()=>root.unmount());host.remove();}
});
it('the actual resource row presents a pending-review status and offers no spending or recovery buttons for that balance',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn(async()=>{});
 try{
  await act(()=>root.render(createElement(ResourceRow,{resource:{id:'spell-slot:2',name:'Authored held slot',max:2,current:1,type:'bar',automatic:true},enabled:true,gm:true,balancePending:true,change} as any)));
  expect(host.textContent).toContain('余量待核对');expect(host.querySelector('button[aria-label="消耗Authored held slot"]')).toBeNull();expect(host.querySelector('button[aria-label="恢复Authored held slot"]')).toBeNull();expect(change).not.toHaveBeenCalled();
 }finally{await act(()=>root.unmount());host.remove();}
});
it('the actual form preserves a named manual record only after explicit acknowledgement, then confirms a separate zero automatic balance',async()=>{
 const s=await setup(),key='spell-slot:2',manual={name:'Authored retained player counter',max:9,current:2,type:'bar',icon:'bottle',automatic:false};s.c.runtime.resources[key]=manual;s.c.spellSettings!.slots['2']={max:9,used:7};await s.render();
 const preserve=s.host.querySelector<HTMLInputElement>('input[aria-label="保留2环位置的手工资源"]')!;expect(preserve).not.toBeNull();expect(preserve.checked).toBe(false);expect(s.input().disabled).toBe(true);await s.click(preserve);expect(s.input().disabled).toBe(false);await s.fill('0');await s.click(s.button());
 const destination=(s.c.runtime.slotCapacityReview as any).lastConfirmation.preservedManualAs;expect(destination).toMatch(/^manual-slot:/);expect(s.c.runtime.resources[destination]).toEqual(manual);expect(s.c.runtime.resources[key]).toMatchObject({max:2,current:0,automatic:true});expect(s.host.textContent).toContain('手工记录已独立保留');
});
it('confirming one ring preserves the typed value and acknowledgement for another unchanged pending ring',async()=>{
 for(const occupied of [false,true]){const s=await setup(),state=s.c.runtime.slotCapacityReview as any;delete s.c.runtime.resources['spell-slot:1'];delete s.c.spellSettings!.slots['1'];delete state.balances['spell-slot:1'];state.pending['spell-slot:1']={max:4};
  if(occupied){s.c.runtime.resources['spell-slot:2']={name:'Authored existing automatic counter',max:2,current:1,automatic:true};s.c.spellSettings!.slots['2']={max:2,used:1};}await s.render();
  if(occupied)await s.click(s.host.querySelector<HTMLInputElement>('input[aria-label="已核对2环已有法术位记录"]')!);await s.fill('1');
  const first=s.host.querySelector<HTMLInputElement>('input[aria-label="1环法术位剩余次数"]')!;await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(first,'0');first.dispatchEvent(new Event('input',{bubbles:true}));});await s.click(s.host.querySelector<HTMLButtonElement>('button[aria-label="确认1环法术位余量"]')!);
  expect(s.c.runtime.resources['spell-slot:1'].current).toBe(0);expect(s.input().value).toBe('1');if(occupied)expect(s.host.querySelector<HTMLInputElement>('input[aria-label="已核对2环已有法术位记录"]')!.checked).toBe(true);expect(s.button().disabled).toBe(false);await s.click(s.button());expect(s.c.runtime.resources['spell-slot:2'].current).toBe(1);
 }
});
