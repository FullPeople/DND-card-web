// @vitest-environment jsdom
// Authored Overview/ValueTrace/NumberInput DOM coverage. NOT RUN locally when
// jsdom is absent; this is not inventory gestures, mounted App or server proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/sheetDisplay',()=>({useSheetRenderMode:()=> 'a4'}));
vi.mock('../src/platform/workbench',()=>{const state={cards:[],monsters:[],inventory:{containers:{}}};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {ABILITY_LABELS,type Ability,type Character} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {projectItemPassiveBonuses} from '../src/core/automation/itemPassiveBonuses';
import {itemPassiveBonusFixture} from './helpers/itemPassiveBonusFlowFixture';
import {itemPassiveBonusSnapshot as snapshot} from './helpers/itemPassiveBonusSourceFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(finalOverrides=false){
 await dispose?.();const f=itemPassiveBonusFixture(453);let c=f.c;if(finalOverrides){c.adjustments=[{id:'authored-ac-final',target:'ac',value:27,reason:'Authored final AC'},{id:'authored-save-final',target:'save:str',value:19,reason:'Authored final strength save'}];c.sheetBonuses={ac:3};c.saveBonuses={str:2};}
 const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(ValueTraceProvider,{c,d,children:createElement(SheetEditContext.Provider,{value:true},createElement(Overview,{c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string,scope:ParentNode=host)=>{const node=scope.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const dialog=(label:string)=>{const rows=[...document.querySelectorAll<HTMLElement>('[role=dialog]')].filter(node=>node.getAttribute('aria-label')===label+'数据追溯');expect(rows).toHaveLength(1);return rows[0];};
 const close=async(label:string)=>{const button=dialog(label).querySelector<HTMLButtonElement>('button[aria-label="关闭数据追溯"]');expect(button).not.toBeNull();await click(button!);};
 const ac=()=>Number(host.querySelector('[data-stat=ac]')?.textContent),save=(a:Ability)=>Number(host.querySelector(`.ability-${a} .ability-save b`)?.textContent);
 const openAc=async()=>{const node=host.querySelector<HTMLElement>('[data-stat=ac]')?.closest<HTMLElement>('[role=button]');expect(node).toBeTruthy();await click(node!);return dialog('护甲等级');};
 const openSave=async(a:Ability)=>{const node=host.querySelector<HTMLElement>(`[aria-label="${ABILITY_LABELS[a]}豁免数据追溯"]`);expect(node).not.toBeNull();await click(node!);return dialog(`${ABILITY_LABELS[a]}豁免`);};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};dispose=async()=>{await unmount();host.remove();};await render();return{host,edit,field,dialog,close,ac,save,openAc,openSave,type,click,render,ownerId:f.owner.id,get c(){return c;},async commit(next:Character){c=next;await render();}};
}

it('actual Overview AC/save trace controls show authenticated source increments and readonly provenance; changed-source/equipment props rerender without saved writes',async()=>{
 const s=await setup(),original=structuredClone(s.c),before=snapshot(s.c),projection=projectItemPassiveBonuses(s.c),strengthTrace=projection.saveTrace.str||[];expect(projection.acTrace.length).toBeGreaterThan(0);expect(strengthTrace.length).toBeGreaterThan(0);expect(s.ac()).toBe(11);expect(s.save('str')).toBe(1);let panel=await s.openAc();expect(s.field('护甲等级追溯输入',panel).readOnly).toBe(true);expect(panel.querySelector('.trace-result strong')?.textContent).toBe('11');for(const row of projection.acTrace)expect(panel.textContent).toContain(row);await s.close('护甲等级');panel=await s.openSave('str');expect(s.field('力量豁免追溯输入',panel).readOnly).toBe(true);expect(panel.querySelector('.trace-result strong')?.textContent).toBe('1');for(const row of strengthTrace)expect(panel.textContent).toContain(row);await s.close('力量豁免');expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(before);
 // These are explicit incoming card prop changes, not invented inventory
 // controls or a claim that a drag/drop/App permission workflow was mounted.
 for(const mode of ['source','equipment','attunement']as const){const changed=structuredClone(original);if(mode==='source')changed.profile.enabledSources=[];if(mode==='equipment')changed.selections.find(row=>row.id===s.ownerId)!.equipped=false;if(mode==='attunement')changed.selections.find(row=>row.id===s.ownerId)!.attuned=false;const expected=snapshot(changed);await s.commit(changed);expect(s.ac()).toBe(10);expect(s.save('str')).toBe(0);const fresh=await s.openAc();expect(fresh.querySelector('.trace-result strong')?.textContent).toBe('10');for(const row of projection.acTrace)expect(fresh.textContent).not.toContain(row);await s.close('护甲等级');expect(snapshot(s.c)).toBe(expected);expect(s.edit).not.toHaveBeenCalled();}
});

it('actual NumberInput trace edits the stored AC offset, not a derived total, while final AC/save overrides and all unrelated saved state retain precedence',async()=>{
 const s=await setup(true),protectedBefore=snapshot([s.c.abilities,s.c.selections,s.c.notes,s.c.runtime,s.c.adjustments,s.c.spellSettings]);expect(s.ac()).toBe(30);expect(s.save('str')).toBe(21);await s.click(s.field('护甲等级调整值'));const panel=s.dialog('护甲等级'),editor=s.field('护甲等级追溯输入',panel);expect(editor.value).toBe('3');expect(editor.readOnly).toBe(false);expect(panel.querySelector('.trace-result strong')?.textContent).toBe('30');await s.type(editor,'4');expect(panel.querySelector('.trace-result strong')?.textContent).toBe('31');expect(s.edit).not.toHaveBeenCalled();await act(()=>{editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.sheetBonuses?.ac).toBe(4);expect(s.ac()).toBe(31);expect(s.save('str')).toBe(21);
 const saveOffset=s.field('力量豁免额外调整值');await act(()=>saveOffset.focus());await s.type(saveOffset,'3');await act(()=>saveOffset.blur());expect(s.edit).toHaveBeenCalledTimes(2);expect(s.c.saveBonuses?.str).toBe(3);expect(s.save('str')).toBe(22);expect(s.ac()).toBe(31);expect(snapshot([s.c.abilities,s.c.selections,s.c.notes,s.c.runtime,s.c.adjustments,s.c.spellSettings])).toBe(protectedBefore);
});
