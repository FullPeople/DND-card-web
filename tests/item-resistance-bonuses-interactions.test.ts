// @vitest-environment jsdom
// Authored actual AutomationPanel/Overview/NumberInput coverage. NOT RUN locally
// without jsdom. Prop transitions below are not invented Inventory/App gestures.
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
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {Overview} from '../src/ui/Overview';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {evaluate} from '../src/core/engine';
import type {Character,Entry} from '../src/core/model';
import {setInfusionTarget} from '../src/core/automation/infusions';
import {itemResistanceBonusFixture} from './helpers/itemResistanceBonusFlowFixture';
import {itemResistanceBonusSnapshot as snapshot} from './helpers/itemResistanceBonusSourceFixture';
import {attunedInfusionFixture} from './e2e/attunedInfusionFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(initial:Character,entries:Entry[],overview=false){
 await dispose?.();let c=initial,writable=true;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(AutomationPanel,{c,d,entries,edit,writable}),overview&&createElement(Overview,{c,d,catalog:entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}))));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const resistance=()=>host.querySelector('[data-testid=automation-resistances]')?.textContent;
 const reasons=()=>{const issues=evaluate(c).issues.filter(issue=>issue.id.startsWith('item-resistance-bonus:'));expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(host.textContent?.includes(issue.message)).toBe(true);};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,resistance,reasons,type,click,get c(){return c;},async commit(next:Character){c=next;await render();},async rights(value:boolean){writable=value;await render();}};
}

it('the actual armor equipment checkbox updates the passive summary, readonly preserves visible provenance, and explicit ring/source/attunement prop changes retain the old infusion union',async()=>{
 const f=itemResistanceBonusFixture(213),s=await setup(f.c,f.entries),before=structuredClone(s.c),checkbox=()=>s.field('装备 '+f.entry.name);expect(s.resistance()).toBe('acid');expect(s.host.textContent?.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);expect(s.host.textContent?.includes(f.entry.name)).toBe(true);const off=structuredClone(before);off.selections.find(row=>row.id===f.owner.id)!.equipped=false;await s.click(checkbox());expect(s.edit).toHaveBeenCalledTimes(1);expect(snapshot(s.c)).toBe(snapshot(off));expect(s.resistance()).toBe('无');s.reasons();await s.click(checkbox());expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(snapshot(before));expect(s.resistance()).toBe('acid');await s.rights(false);expect(checkbox().matches(':disabled')).toBe(true);const readonly=snapshot(s.c);await s.click(checkbox());expect(s.edit).toHaveBeenCalledTimes(2);expect(s.resistance()).toBe('acid');expect(snapshot(s.c)).toBe(readonly);
 const ring=itemResistanceBonusFixture(1752),old=attunedInfusionFixture(),armor=old.options.find(row=>row.english==='Resistant Armor')!;ring.c.selections.push(...structuredClone(old.c.selections));ring.c.answers={...ring.c.answers,...structuredClone(old.c.answers)};ring.c.classChoiceSnapshots=structuredClone(old.c.classChoiceSnapshots);ring.c.profile.enabledSources=[...new Set([...ring.c.profile.enabledSources,...old.c.profile.enabledSources])];setInfusionTarget(ring.c,old.choiceId,armor.id,'attuned-item-0',{damageType:'fire'});const r=await setup(ring.c,[...ring.entries,...old.entries]),original=structuredClone(r.c),intent=snapshot(r.c.infusions);expect(r.resistance()).toBe('acid、fire');expect(r.host.textContent?.includes(ring.entry.name)).toBe(true);expect(r.host.textContent?.includes('抗性护甲')).toBe(true);for(const mode of ['source','equipment','attunement']as const){const c=structuredClone(original),owner=c.selections.find(row=>row.id===ring.owner.id)!;if(mode==='source')c.profile.enabledSources=c.profile.enabledSources.filter(source=>source!==ring.entry.source);if(mode==='equipment')owner.equipped=false;if(mode==='attunement')owner.attuned=false;const expected=snapshot(c);await r.commit(c);expect(r.resistance()).toBe('fire');r.reasons();expect(r.edit).not.toHaveBeenCalled();expect(snapshot(r.c)).toBe(expected);expect(snapshot(r.c.infusions)).toBe(intent);}
});

it('the real Overview arithmetic HP editor applies the explicit literal subtraction without automatic resistance reduction, temp-HP absorption or other saved-state writes',async()=>{
 const f=itemResistanceBonusFixture(1752);f.c.baseHp=20;f.c.runtime.hp=9;const s=await setup(f.c,f.entries,true),before=structuredClone(s.c),expected=structuredClone(s.c);expected.runtime.hp=5;expect(s.resistance()).toBe('acid');const hp=s.field('当前生命值');expect(hp.value).toBe('9');await act(()=>hp.focus());await s.type(hp,'-4');expect(s.edit).not.toHaveBeenCalled();await act(()=>hp.blur());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.field('当前生命值').value).toBe('5');expect(s.c.runtime.hp).toBe(5);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);expect(s.resistance()).toBe('acid');expect(snapshot(s.c)).toBe(snapshot(expected));expect(snapshot(s.c.selections)).toBe(snapshot(before.selections));expect(s.host.textContent?.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);
 const changed=structuredClone(s.c);changed.selections.find(row=>row.id===f.owner.id)!.attuned=false;const incoming=snapshot(changed);await s.commit(changed);expect(s.resistance()).toBe('无');s.reasons();expect(s.c.runtime.hp).toBe(5);expect(s.c.runtime.tempHp).toBe(2);expect(snapshot(s.c)).toBe(incoming);expect(s.edit).toHaveBeenCalledTimes(1);
});
