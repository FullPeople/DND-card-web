// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Character} from '../src/core/model';
import {ItemAtWillSpellControl} from '../src/ui/ItemAtWillSpellControl';
import {SourceSpellActions} from '../src/ui/SourceSpellActions';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {itemAtWillFixture,itemAtWillSnapshot} from './helpers/itemAtWillFixture';
import {itemAtWillOffer} from '../src/core/automation/itemAtWill';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
/** Actual frozen source, leaf/source-action events and domain APIs. The host
 * models delayed edits and save captions, not mounted App or server authority. */
async function setup(english='Boots of Levitation'){
 await dispose?.();const f=itemAtWillFixture(english);let c=f.c,entries=f.entries,writable=true,active=true,defer=false,submit=true,saveLabel='已保存到本机',pending:((draft:Character)=>void)|undefined;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);syncSourceSpells(draft,entries);c=draft;draw();});
 function draw(){const child=c.selections.find(row=>row.parentId===f.owner.id&&row.entry.kind==='spell');root?.render(createElement(RetainedCardVisibility.Provider,{value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:()=>{}}},createElement('main',null,createElement(ItemAtWillSpellControl,{c,ownerId:f.owner.id,entries,edit,writable}),child&&createElement(SourceSpellActions,{c,id:child.id,edit,readOnly:!writable}))))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const checkbox=()=>{const node=host.querySelector<HTMLInputElement>('input[aria-label="确认当前真实拥有此物品来源"]');expect(node).not.toBeNull();return node!;};
 const button=(name:string)=>{const rows=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===name);expect(rows).toHaveLength(1);return rows[0];};
 const confirm=async()=>{await click(checkbox());await click(button('确认物品随意施法来源'));};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();return{host,checkbox,button,click,confirm,render,unmount,get c(){return c;},get pending(){return pending;},get offer(){return itemAtWillOffer(c,f.owner.id,entries);},get entries(){return entries;},get ownerId(){return f.owner.id;},set writable(v:boolean){writable=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set saveLabel(v:string){saveLabel=v;}};
}
it('explicit actual Boots source confirmation observes the real intent, shows validated self-only free action, preserves manual/native state and save-failure honesty',async()=>{
 const s=await setup(),manual=itemAtWillSnapshot([s.c.abilities,s.c.runtime.resources,s.c.runtime.hp,s.c.notes]);expect(s.checkbox().checked).toBe(false);expect(s.button('确认物品随意施法来源').disabled).toBe(true);expect(s.c.selections.some(row=>row.entry.kind==='spell')).toBe(false);s.saveLabel='保存失败：authored failure';await s.render();await s.confirm();expect(s.offer.active).toBe(true);expect(s.host.querySelector('[data-item-atwill-phase=applied]')).not.toBeNull();expect(s.host.querySelector('[data-testid=item-atwill-save-state]')?.textContent).toBe('保存失败：authored failure');expect(s.host.querySelector('[data-item-target-scope=self]')?.textContent).toContain('不能扩展到其他目标');const use=s.button('使用');await act(()=>{use.click();use.click();});expect(s.c.runtime.automationActions?.sequence).toBe(1);expect(itemAtWillSnapshot([s.c.abilities,s.c.runtime.resources,s.c.runtime.hp,s.c.notes])).toBe(manual);const reopened=readCharacter(exportCharacter(s.c)).character;syncSourceSpells(reopened,s.entries);expect(reopened.automation?.itemAtWill).toEqual(s.c.automation?.itemAtWill);await s.click(s.button('撤回物品随意施法来源'));expect(s.offer.active).toBe(false);expect(s.c.automation?.itemAtWill?.sequence).toBe(2);expect(s.host.querySelector('[data-item-atwill-phase=applied]')).not.toBeNull();expect(s.button('使用').disabled).toBe(true);expect(itemAtWillSnapshot([s.c.abilities,s.c.runtime.resources,s.c.runtime.hp,s.c.notes])).toBe(manual);
});
it('cancel, current readonly/hidden/unmounted/card/source changes revoke a deferred confirmation and repeated callbacks cannot repeat consent',async()=>{
 for(const mode of ['cancel','readonly','hide','unmount','card','source','apply'] as const){const s=await setup('Helm of Comprehending Languages');s.defer=true;await s.confirm();const pending=s.pending!;expect(pending).toBeDefined();if(mode==='cancel')await s.click(s.button('取消物品来源核对'));else if(mode==='readonly'){s.writable=false;await s.render();}else if(mode==='hide'){s.active=false;await s.render();}else if(mode==='unmount')await s.unmount();const draft=structuredClone(s.c);if(mode==='card')draft.id='authored-new-card';if(mode==='source')draft.profile.enabledSources=[];const before=itemAtWillSnapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(draft.automation?.itemAtWill?.sequence).toBe(1);const once=itemAtWillSnapshot(draft);await act(()=>pending(draft));expect(itemAtWillSnapshot(draft)).toBe(once);}else expect(itemAtWillSnapshot(draft)).toBe(before);}
});
it('ignored edits time out unconfirmed and forged/future raw intent nonce cannot acknowledge an operation without the authenticated source anchor',async()=>{
 const ignored=await setup();ignored.submit=false;vi.useFakeTimers();const before=itemAtWillSnapshot(ignored.c);await ignored.confirm();expect(ignored.host.querySelector('[data-item-atwill-phase=applied]')).toBeNull();await act(async()=>{await vi.advanceTimersByTimeAsync(4501);});expect(ignored.host.querySelector('[data-item-atwill-phase=unconfirmed]')).not.toBeNull();expect(itemAtWillSnapshot(ignored.c)).toBe(before);vi.useRealTimers();
 for(const mode of ['future','anchor'] as const){const s=await setup();s.defer=true;await s.confirm();const uncommitted=structuredClone(s.c);await act(()=>s.pending!(uncommitted));const store=structuredClone(uncommitted.automation!.itemAtWill!);expect(store.sequence).toBe(1);if(mode==='future')(s.c.automation as any).itemAtWill={...store,version:9,opaque:{keep:true}};else{store.records[0].snapshotSha256='0'.repeat(64);s.c.automation!.itemAtWill=store;}await s.render();expect(s.host.querySelector('[data-item-atwill-phase=applied]')).toBeNull();}
});
