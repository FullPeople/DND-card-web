// @vitest-environment jsdom
// Authored actual client createRoot/AutomationPanel/Overview/provider events.
// Executed with jsdom. The real workbench receives its existing
// host protocol; no workbench, authority, actor, engine or control is mocked.
// Only these six unrelated Overview children are suppressed, as in native HP.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
const originalHash=vi.hoisted(()=>{const hash=location.hash;history.replaceState(null,'','#suite=item-affine-hp-ui&bridge='+encodeURIComponent(location.origin));return hash;});
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
import {removeSelection} from '../src/core/sheet';
import {itemAffineHpOffer,itemAffineHpReceipt} from '../src/core/automation/itemAffineHp';
import {getWorkbench,inWorkbench,workbenchCharacterId} from '../src/platform/workbench';
import type {Character} from '../src/core/model';
import {itemAffineHpFixture} from './helpers/itemAffineHpFlowFixture';
import {itemAffineHpSourceEvidence,itemAffineHpSnapshot as snapshot} from './helpers/itemAffineHpSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{},ackKey='item-affine-hp:acknowledgements';let dispose:(()=>Promise<void>)|undefined,hostStarted=100,wireSequence=0;
const preserved=(c:Character)=>{const copy=structuredClone(c);delete copy.answers[ackKey];return snapshot(copy);};
// These are real accepted browser messages at the production host boundary,
// not replacement module exports or writes to getWorkbench()'s current state.
function wire(type:string,payload:Record<string,unknown>={}){window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'item-affine-hp-ui',hostStarted,type,...payload}}));}
beforeAll(()=>{itemAffineHpSourceEvidence();expect(inWorkbench).toBe(true);},30000);
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
afterAll(()=>{history.replaceState(null,'',originalHash||location.pathname+location.search);});
async function setup(key='14:72'){
 await dispose?.();const f=itemAffineHpFixture(key);let c=f.c,writable=true,canEdit=true,active=true,defer=false,submit=true,saveLabel='已保存到本机',session=0,pending:((draft:Character)=>void)|undefined,role='PLAYER';
 const targetKey='authored-item-affine-hp-'+(++hostStarted);c.id='suite:'+targetKey;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const target=()=>({key:targetKey,itemId:'card:authored-item-affine-hp',cardId:'authored-item-affine-hp',slug:'authored',name:'Authored HP card',kind:'character' as const,stats:{},write:true,role,pinned:false});
 const cards=()=>[{id:'authored-item-affine-hp',name:'Authored HP card',write:true,locked:!!c.locked,inScene:true,itemId:target().itemId,resources:[],stats:{}}];
 // New host epoch resets the real previous access/selection state. The actual
 // target identity must match suite:<key>, exactly as the production hook uses.
 wireSequence=0;wire('ready',{role,enabled:{},groupDeferred:true});wire('catalog',{sequence:++wireSequence,role,enabled:{},cards:cards(),monsters:[]});wire('selection',{sequence:++wireSequence,state:target()});expect(getWorkbench().online).toBe(true);expect(workbenchCharacterId(getWorkbench().target!)).toBe(c.id);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{if(!submit)return;if(defer){pending=fn;return;}const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(RetainedCardVisibility.Provider,{key:c.id+':'+session,value:active},createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit,open:noop,close:noop}},createElement(FeedbackContext.Provider,{value:{scope:c.id,saveLabel,announce:noop}},createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.catalog,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.catalog,edit,writable})))})))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const control=(ownerId=f.owner.id)=>{const nodes=[...host.querySelectorAll<HTMLElement>('[data-item-affine-hp-owner]')].filter(node=>node.dataset.itemAffineHpOwner===ownerId);expect(nodes.length).toBe(1);return nodes[0];};
 const checkbox=(ownerId=f.owner.id)=>{const node=control(ownerId).querySelector<HTMLInputElement>('input[aria-label="确认本件物品未计入手工生命值上限"]');expect(node).not.toBeNull();return node!;};
 const button=(name:string,ownerId=f.owner.id)=>{const nodes=[...control(ownerId).querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===name);expect(nodes.length).toBe(1);return nodes[0];};
 const confirm=async(ownerId=f.owner.id)=>{await click(checkbox(ownerId));await click(button('确认本件物品生命值加值',ownerId));},hp=()=>Number(host.querySelector('[data-stat=hp]')?.firstChild?.textContent),phase=(value:string,ownerId=f.owner.id)=>control(ownerId).querySelector(`[data-item-affine-hp-phase="${value}"]`);
 const equip=()=>{const nodes=[...host.querySelectorAll<HTMLInputElement>('input')].filter(node=>node.getAttribute('aria-label')==='装备 '+f.entry.name);expect(nodes).toHaveLength(1);return nodes[0];};
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();return{host,edit,render,click,control,checkbox,button,confirm,hp,phase,equip,unmount,get c(){return c;},get pending(){return pending;},get ownerId(){return f.owner.id;},get offer(){return itemAffineHpOffer(c,f.owner.id,{canEdit:true,gm:role==='GM'});},set writable(v:boolean){writable=v;},set canEdit(v:boolean){canEdit=v;},set active(v:boolean){active=v;},set defer(v:boolean){defer=v;},set submit(v:boolean){submit=v;},set saveLabel(v:string){saveLabel=v;},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;session++;await render();},async role(next:string,renderNow=true){role=next;await act(()=>wire('catalog',{sequence:++wireSequence,role,enabled:{},cards:cards(),monsters:[]}));expect(getWorkbench().role).toBe(next);if(renderNow)await render();}};
}
function runtime(c:Character){expect(c.runtime.hp).toBe(7);expect(c.runtime.tempHp).toBe(2);expect(c.runtime.resources.manual.current).toBe(1);}

it('real panel explicit per-item confirmation projects axes and armor, observes saved-card receipts/save failures and survives native reopen/withdraw/reconfirm without healing',async()=>{
 for(const key of ['14:72','15:73','named:2316','33:59','34:59']){const s=await setup(key),manual=preserved(s.c),bonus=s.offer!.constant+7;expect(s.checkbox().checked).toBe(false);expect(s.button('确认本件物品生命值加值').disabled).toBe(true);expect(s.hp()).toBe(42);s.saveLabel='保存失败：authored';await s.render();await s.confirm();expect(s.offer?.active).toBe(true);expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(42+bonus);expect(s.control().querySelector('[data-testid=item-affine-hp-save-state]')?.textContent).toBe('保存失败：authored');expect(preserved(s.c)).toBe(manual);runtime(s.c);const saved=snapshot(s.c);await s.reopen();expect(snapshot(s.c)).toBe(saved);expect(s.hp()).toBe(42+bonus);expect(s.checkbox().checked).toBe(false);expect(s.phase('applied')).toBeNull();await s.click(s.button('撤回本件物品生命值确认'));expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(42);expect(preserved(s.c)).toBe(manual);await s.confirm();expect(s.hp()).toBe(42+bonus);expect(s.phase('applied')).not.toBeNull();expect(preserved(s.c)).toBe(manual);runtime(s.c);}
});

it('actual existing armor/weapon equip and automation toggles obey source conditions without fabricated grants, while manual-basis changes and new physical IDs require fresh consent',async()=>{
 for(const key of ['14:72','33:59']){const s=await setup(key);await s.confirm();const answer=s.c.answers[ackKey][0],isArmor=s.offer!.sourceCondition==='worn-and-attuned',bonus=s.offer!.constant+7;expect(s.equip().checked).toBe(isArmor);await s.click(s.equip());expect(s.hp()).toBe(isArmor?42:42+bonus);expect(s.c.answers[ackKey][0]).toBe(answer);await s.click(s.equip());expect(s.hp()).toBe(42+bonus);const enabled=s.host.querySelector<HTMLInputElement>('input[aria-label="启用自动计算"]')!;await s.click(enabled);expect(s.hp()).toBe(42);expect(s.c.answers[ackKey][0]).toBe(answer);await s.click(enabled);expect(s.hp()).toBe(42+bonus);expect(s.c.answers[ackKey][0]).toBe(answer);expect(s.checkbox().checked).toBe(false);
  const next=structuredClone(s.c);next.baseHp=41;await s.commit(next);expect(s.hp()).toBe(43);expect(s.checkbox().checked).toBe(false);expect(s.offer?.confirmed).toBe(true);expect(s.offer?.active).toBe(false);await s.confirm();expect(s.hp()).toBe(43+bonus);runtime(s.c);
  const replaced=structuredClone(s.c),old=structuredClone(replaced.selections.find(row=>row.id===s.ownerId)!);removeSelection(replaced,s.ownerId);const newId='authored-new-physical-item';replaced.selections.push({...old,id:newId});const retained=replaced.answers[ackKey][0];await s.commit(replaced);expect(s.hp()).toBe(43);expect(s.checkbox(newId).checked).toBe(false);expect(s.c.answers[ackKey][0]).toBe(retained);await s.confirm(newId);expect(s.hp()).toBe(43+bonus);runtime(s.c);
 }
});

it('cancel/readonly/live demotion/retained hide/unmount and changed card/source/manual/owner/attunement/quantity/level reject delayed writes; repeated clicks/callbacks write once and wait for the actual observed card',async()=>{
 for(const mode of ['cancel','readonly','demotion','hide','unmount','card','source','manual','owner','attunement','quantity','level','apply']as const){const s=await setup();s.defer=true;await s.click(s.checkbox());const confirm=s.button('确认本件物品生命值加值');await act(()=>{confirm.click();confirm.click();});expect(s.edit).toHaveBeenCalledTimes(1);const pending=s.pending!;expect(pending).toBeDefined();if(mode==='cancel')await s.click(s.button('取消本件物品生命值核对'));if(mode==='readonly'){s.writable=false;await s.render();}if(mode==='demotion'){s.canEdit=false;await s.render();expect(s.checkbox().matches(':disabled')).toBe(true);}if(mode==='hide'){s.active=false;await s.render();}if(mode==='unmount')await s.unmount();if(mode==='card'){const next=structuredClone(s.c);next.id='authored-other-card';await s.commit(next);}const draft=structuredClone(s.c);if(mode==='source')draft.profile.enabledSources=[];if(mode==='manual')draft.baseHp=41;if(mode==='owner')removeSelection(draft,s.ownerId);if(mode==='attunement')draft.selections.find(row=>row.id===s.ownerId)!.attuned=false;if(mode==='quantity')draft.selections.find(row=>row.id===s.ownerId)!.quantity=2;if(mode==='level')draft.selections.find(row=>row.entry.kind==='class')!.level++;const before=snapshot(draft);await act(()=>pending(draft));if(mode==='apply'){expect(snapshot(draft)===before).toBe(false);const once=snapshot(draft);await act(()=>pending(draft));expect(snapshot(draft)).toBe(once);expect(s.phase('applied')).toBeNull();await s.commit(readCharacter(exportCharacter(draft)).character);expect(s.phase('applied')).not.toBeNull();expect(s.hp()).toBe(49);runtime(s.c);}else expect(snapshot(draft)).toBe(before);}
});

it('real current host GM demotion cancels locked-card confirmation and withdrawal callbacks, but confirmed pure maximum HP remains visible',async()=>{
 for(const kind of ['confirm','withdraw']as const){const s=await setup();s.c.locked=true;await s.role('GM');expect(s.button('确认本件物品生命值加值').disabled).toBe(true);if(kind==='withdraw'){await s.confirm();expect(s.hp()).toBe(49);}s.defer=true;if(kind==='confirm')await s.confirm();else await s.click(s.button('撤回本件物品生命值确认'));expect(s.pending).toBeDefined();const pending=s.pending!;await s.role('PLAYER',false);const draft=structuredClone(s.c),before=snapshot(draft);await act(()=>pending(draft));expect(snapshot(draft)).toBe(before);expect(s.phase('applied')).toBeNull();expect(s.hp()).toBe(kind==='withdraw'?49:42);expect(s.checkbox().matches(':disabled')).toBe(true);runtime(s.c);}
});

it('ignored edits remain unconfirmed, while future or forged current-last receipt histories never claim applied from a matching request ID',async()=>{
 const ignored=await setup();ignored.submit=false;const before=snapshot(ignored.c);vi.useFakeTimers();await ignored.confirm();expect(ignored.phase('applied')).toBeNull();await act(async()=>{await vi.advanceTimersByTimeAsync(4501);});expect(ignored.phase('unconfirmed')).not.toBeNull();expect(snapshot(ignored.c)).toBe(before);vi.useRealTimers();
 for(const mode of ['future','fingerprint']as const){const s=await setup();s.defer=true;await s.confirm();const requestId=s.control().querySelector('[data-item-affine-hp-request]')?.getAttribute('data-item-affine-hp-request');expect(typeof requestId).toBe('string');const draft=structuredClone(s.c);await act(()=>s.pending!(draft));const raw=draft.answers[ackKey][0],store=JSON.parse(raw);if(mode==='future')draft.answers[ackKey]=[JSON.stringify({...store,version:999,opaque:{retained:true}})];else{const receipt=itemAffineHpReceipt(draft,requestId!);expect(receipt).toBeDefined();expect(raw.includes(receipt!.fingerprint)).toBe(true);draft.answers[ackKey]=[raw.replaceAll(receipt!.fingerprint,'0'.repeat(64))];}const incoming=snapshot(draft);await s.commit(draft);expect(s.phase('applied')).toBeNull();expect(snapshot(s.c)).toBe(incoming);expect(s.hp()).toBe(42);runtime(s.c);}
});
