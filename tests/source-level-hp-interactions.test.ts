// @vitest-environment jsdom
// Authored real panel/control/Overview/provider events; NOT RUN locally without
// jsdom. The host models deferred edits and save captions, not full App/server.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {Overview} from '../src/ui/Overview';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {sourceLevelHpOffer,sourceLevelHpReceipt} from '../src/core/automation/sourceLevelHp';
import type {Character} from '../src/core/model';
import {sourceLevelHpFixture} from './helpers/sourceLevelHpFlowFixture';
import {sourceLevelHpSnapshot as snapshot} from './helpers/sourceLevelHpSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{},ackKey='source-level-hp:acknowledgements';let dispose:(()=>Promise<void>)|undefined;
const preserved=(c:Character)=>{const copy=structuredClone(c);delete copy.answers[ackKey];return snapshot(copy);};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.useRealTimers();vi.restoreAllMocks();});
async function setup(key='race/34'){
 await dispose?.();const f=sourceLevelHpFixture(key);let c=f.c,writable=true,canEdit=true,active=true,defer=false,submit=true,saveLabel='已保存到本机',session=0,pending:((draft:Character)=>void)|undefined;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(RetainedCardVisibility.Provider,{key:c.id+':'+session,value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit,open:noop,close:noop}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:noop}},createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.catalog,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.catalog,edit,writable})))})))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const control=()=>{const nodes=[...host.querySelectorAll<HTMLElement>('[data-source-level-hp-owner]')].filter(node=>node.dataset.sourceLevelHpOwner===f.owner.id);expect(nodes.length).toBe(1);return nodes[0];};
 const checkbox=()=>{const node=control().querySelector<HTMLInputElement>('input[aria-label="确认本来源未计入手工生命值上限"]');expect(node).not.toBeNull();return node!;};
 const button=(name:string)=>{const nodes=[...control().querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===name);expect(nodes.length).toBe(1);return nodes[0];};
 const confirm=async()=>{await click(checkbox());await click(button('确认来源生命值加值'));},hp=()=>Number(host.querySelector('[data-stat=hp]')?.firstChild?.textContent),phase=(value:string)=>control().querySelector(`[data-source-level-hp-phase="${value}"]`);
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();return{host,edit,render,click,control,checkbox,button,confirm,hp,phase,unmount,get c(){return c;},get pending(){return pending;},get ownerId(){return f.owner.id;},get offer(){return sourceLevelHpOffer(c,f.owner.id,{canEdit:true,gm:true});},set writable(v:boolean){writable=v;},set canEdit(v:boolean){canEdit=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set saveLabel(v:string){saveLabel=v;},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;session++;await render();}};
}

it('actual panel confirmation changes only the source acknowledgement and maximum HP, observes receipt and save-failure status, and persists withdrawal or reconfirmation without healing',async()=>{
 const s=await setup(),manual=preserved(s.c);expect(s.checkbox().checked).toBe(false);expect(s.button('确认来源生命值加值').disabled).toBe(true);expect(s.hp()).toBe(42);s.saveLabel='保存失败：authored';await s.render();await s.confirm();expect(s.offer?.active).toBe(true);expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(49);expect(s.control().querySelector('[data-testid=source-level-hp-save-state]')?.textContent).toBe('保存失败：authored');expect(preserved(s.c)).toBe(manual);expect(s.c.runtime.hp).toBe(7);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);const saved=snapshot(s.c);await s.reopen();expect(snapshot(s.c)).toBe(saved);expect(s.hp()).toBe(49);expect(s.checkbox().checked).toBe(false);expect(s.phase('applied')).toBeNull();await s.click(s.button('撤回来源生命值确认'));expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(42);expect(preserved(s.c)).toBe(manual);await s.confirm();expect(s.hp()).toBe(49);expect(s.phase('applied')).not.toBeNull();expect(preserved(s.c)).toBe(manual);
});

it('cancel, readonly, current context demotion, hidden or unmounted cards and changed card/source/manual/lock bases reject deferred writes, while repeated callbacks apply only once and never ACK an unobserved draft',async()=>{
 for(const mode of ['cancel','readonly','demotion','hide','unmount','card','source','manual','lock','apply']as const){const s=await setup();s.defer=true;await s.click(s.checkbox());const confirm=s.button('确认来源生命值加值');await act(()=>{confirm.click();confirm.click();});expect(s.edit).toHaveBeenCalledTimes(1);const pending=s.pending!;expect(!!pending).toBe(true);if(mode==='cancel')await s.click(s.button('取消来源生命值核对'));if(mode==='readonly'){s.writable=false;await s.render();}if(mode==='demotion'){s.canEdit=false;await s.render();expect(s.checkbox().matches(':disabled')).toBe(true);}if(mode==='hide'){s.active=false;await s.render();}if(mode==='unmount')await s.unmount();if(mode==='card'){const next=structuredClone(s.c);next.id='authored-other-card';await s.commit(next);}if(mode==='lock'){const next=structuredClone(s.c);next.locked=true;await s.commit(next);}const draft=structuredClone(s.c);if(mode==='source')draft.profile.enabledSources=[];if(mode==='manual')draft.baseHp=41;const before=snapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(snapshot(draft)===before).toBe(false);const once=snapshot(draft);await act(()=>pending(draft));expect(snapshot(draft)).toBe(once);expect(s.phase('applied')).toBeNull();await s.commit(readCharacter(exportCharacter(draft)).character);expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(49);}else expect(snapshot(draft)).toBe(before);}
});

it('ignored edits stay unconfirmed and authenticated receipt checks reject future or forged namespace history rather than claiming success from a matching operation ID',async()=>{
 const ignored=await setup();ignored.submit=false;const before=snapshot(ignored.c);vi.useFakeTimers();await ignored.confirm();expect(ignored.phase('applied')).toBeNull();await act(async()=>{await vi.advanceTimersByTimeAsync(4501);});expect(ignored.phase('unconfirmed')).not.toBeNull();expect(snapshot(ignored.c)).toBe(before);vi.useRealTimers();
 for(const mode of ['future','fingerprint']as const){const s=await setup();s.defer=true;await s.confirm();const requestId=s.control().querySelector('[data-source-level-hp-request]')?.getAttribute('data-source-level-hp-request');expect(typeof requestId).toBe('string');const draft=structuredClone(s.c);await act(()=>s.pending!(draft));const raw=draft.answers[ackKey][0],store=JSON.parse(raw);if(mode==='future')draft.answers[ackKey]=[JSON.stringify({...store,version:999,opaque:{retained:true}})];else{const receipt=sourceLevelHpReceipt(draft,requestId!);expect(!!receipt).toBe(true);expect(raw.includes(receipt!.fingerprint)).toBe(true);draft.answers[ackKey]=[raw.replaceAll(receipt!.fingerprint,'0'.repeat(64))];}const incoming=snapshot(draft);await s.commit(draft);expect(s.phase('applied')).toBeNull();expect(snapshot(s.c)).toBe(incoming);}
});
