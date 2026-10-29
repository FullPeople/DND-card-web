// @vitest-environment jsdom
// Authored actual Overview/NumberInput/AutomationPanel interactions. NOT RUN
// locally without jsdom; incoming source props are not Inventory/App proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={cards:[],monsters:[],inventory:{containers:{}}};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/cloud/localRights',()=>({localGm:()=>false}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4',useSheetCaptureActive:()=>false}));
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {evaluate} from '../src/core/engine';
import type {Character} from '../src/core/model';
import {relativeRacialMovementFixture} from './helpers/relativeRacialMovementFlowFixture';
import {relativeRacialMovementSnapshot as snapshot} from './helpers/relativeRacialMovementSourceFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(f=relativeRacialMovementFixture(),writable=true){
 await dispose?.();let c=f.c;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.entries,edit,writable})))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string,scope:ParentNode=host)=>{const node=scope.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const summary=()=>{const node=host.querySelector<HTMLElement>('[data-relative-racial-movement-summary]');expect(node).not.toBeNull();return node!;};
 const feet=()=>{const node=summary().querySelector(`[data-testid="relative-racial-movement-${f.spec.mode}"]`);return node?Number(node.textContent):undefined;};
 const walking=()=>Number(host.querySelector('[data-stat=speed]')?.firstChild?.textContent);
 const dialog=()=>{const rows=[...document.querySelectorAll<HTMLElement>('[role=dialog]')].filter(node=>node.getAttribute('aria-label')==='速度数据追溯');expect(rows).toHaveLength(1);return rows[0];};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,summary,feet,walking,dialog,type,click,get c(){return c;},async commit(next:Character){c=next;await render();}};
}

it('the existing walking-offset NumberInput previews the stored offset and commits once before the readonly source relation follows the actual final walking result',async()=>{
 const f=relativeRacialMovementFixture(),s=await setup(f),before=structuredClone(s.c),expected=structuredClone(s.c);expected.sheetBonuses!.speed=5;expect(s.walking()).toBe(50);expect(s.feet()).toBe(50);expect(s.summary().querySelector('input,button,select,textarea')).toBeNull();await s.click(s.field('速度调整值'));const panel=s.dialog(),input=s.field('速度追溯输入',panel);expect(input.value).toBe('3');expect(panel.querySelector('.trace-result strong')?.textContent).toBe('50');await s.type(input,'5');expect(panel.querySelector('.trace-result strong')?.textContent).toBe('52');expect(s.feet()).toBe(50);expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(snapshot(before));await act(()=>{input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.sheetBonuses!.speed).toBe(5);expect(s.c.adjustments![0].value).toBe(47);expect(s.walking()).toBe(52);expect(s.feet()).toBe(52);expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.summary().querySelector('input,button,select,textarea')).toBeNull();
 const saved=snapshot(s.c),off=structuredClone(s.c);off.automation!.enabled=false;await s.click(s.field('启用自动计算'));expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(snapshot(off));expect(s.walking()).toBe(52);expect(s.feet()).toBeUndefined();await s.click(s.field('启用自动计算'));expect(s.edit).toHaveBeenCalledTimes(3);expect(snapshot(s.c)).toBe(saved);expect(s.feet()).toBe(52);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.resources.manual.current).toBe(1);
});

it('readonly real components retain a legitimate zero swim relation without editors, while source/owner prop transitions preserve zero walking and every incoming saved byte',async()=>{
 const f=relativeRacialMovementFixture('race/105');f.c.adjustments![0].value=0;f.c.sheetBonuses!.speed=0;const s=await setup(f,false),original=structuredClone(s.c),before=snapshot(s.c);expect(s.walking()).toBe(0);expect(s.feet()).toBe(0);expect(s.summary().textContent?.includes('与当前步行速度相同')).toBe(true);expect(s.summary().querySelector('input,button,select,textarea')).toBeNull();expect(s.host.querySelector('input[aria-label="速度调整值"]')).toBeNull();expect(s.field('启用自动计算').matches(':disabled')).toBe(true);await s.click(s.field('启用自动计算'));expect(snapshot(s.c)).toBe(before);expect(s.edit).not.toHaveBeenCalled();
 // These are supplied card-state changes, not fabricated inventory gestures.
 for(const mode of ['source','owner']as const){const c=structuredClone(original);if(mode==='source')c.profile.enabledSources=[];else c.selections=c.selections.filter(row=>row.id!==f.owner.id);const incoming=snapshot(c);await s.commit(c);expect(s.walking()).toBe(0);expect(s.feet()).toBeUndefined();expect(s.summary().textContent?.includes('不推定默认速度')).toBe(true);expect(s.summary().textContent?.includes('777')).toBe(false);expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(incoming);}
 await s.commit(original);expect(s.walking()).toBe(0);expect(s.feet()).toBe(0);expect(snapshot(s.c)).toBe(before);expect(s.edit).not.toHaveBeenCalled();
});
