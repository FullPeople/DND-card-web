// @vitest-environment jsdom
// Real component-host checkbox/identity controls and native roundtrip only.
// NOT RUN locally without jsdom; not full App, drag, Inventory or server proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
// Display-only peripherals, never source/identity/authority/mutation providers.
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {Overview} from '../src/ui/Overview';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import type {Character} from '../src/core/model';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSnapshot as snapshot} from './helpers/inheritedRacialResistanceSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
const order=['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'];
const display=(types:readonly string[])=>order.filter(type=>types.includes(type)).join('、')||'无';
async function setup(f:ReturnType<typeof inheritedRacialResistanceFixture>){
 await dispose?.();let c=f.c,writable=true;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.entries,edit,writable})))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const toggle=()=>{const node=host.querySelector<HTMLInputElement>('input[aria-label="启用自动计算"]');expect(node).not.toBeNull();return node!;};
 const resistance=()=>host.querySelector('[data-testid=automation-resistances]')?.textContent;
 const identity=()=>{const rows=[...host.querySelectorAll<HTMLElement>('.identity-token')].filter(node=>node.dataset.selectionId===f.owner.id);expect(rows.length).toBe(1);const button=rows[0].querySelector<HTMLButtonElement>('button.identity-title');expect(button).not.toBeNull();expect(button!.getAttribute('data-reference')).toBe(`race:entry:${f.entry.id}`);return button!;};
 const reasons=()=>{const issues=evaluate(c).issues.filter(issue=>issue.id.startsWith('racial-resistance:'));expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(host.textContent?.includes(issue.message)).toBe(true);};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,toggle,click,identity,resistance,reasons,get c(){return c;},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;await render();},async rights(value:boolean){writable=value;await render();}};
}

it('the actual enable checkbox pauses and restores a complete inherited owner across native reopen, while readonly blocks writes and preserves the visible source result',async()=>{
 const f=inheritedRacialResistanceFixture(),s=await setup(f),original=structuredClone(s.c),before=snapshot(s.c),disabled=structuredClone(s.c);disabled.automation!.enabled=false;expect(s.resistance()).toBe(display(f.spec.resistances));expect(s.host.textContent?.includes(f.entry.name)).toBe(true);await s.click(s.toggle());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.resistance()).toBe('无');s.reasons();expect(snapshot(s.c)).toBe(snapshot(disabled));await s.reopen();expect(snapshot(s.c)).toBe(snapshot(disabled));expect(s.resistance()).toBe('无');await s.click(s.toggle());expect(s.edit).toHaveBeenCalledTimes(2);expect(s.resistance()).toBe(display(f.spec.resistances));expect(snapshot(s.c)).toBe(before);await s.reopen();expect(snapshot(s.c)).toBe(before);
 await s.rights(false);expect(s.toggle().matches(':disabled')).toBe(true);await s.click(s.toggle());expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(before);expect(s.resistance()).toBe(display(f.spec.resistances));const incoming=structuredClone(original);incoming.profile.enabledSources=[];const paused=snapshot(incoming);await s.commit(incoming);s.reasons();expect(s.resistance()).toBe('无');expect(snapshot(s.c)).toBe(paused);expect(s.edit).toHaveBeenCalledTimes(2);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);
});

it('the actual unnamed native child identity uses its real no-suffix label and Delete removes only that root after readonly refusal, with the result preserved through reopening',async()=>{
 const f=inheritedRacialResistanceFixture('subrace/82'),s=await setup(f),original=structuredClone(s.c),before=snapshot(s.c);expect(s.resistance()).toBe('fire');expect(s.identity().textContent).toBe(f.entry.name);expect(f.entry.name).toBe(f.rule.sourceProof.parent.normalizedHeader.name);expect(f.entry.id===f.rule.sourceProof.parent.normalizedId).toBe(false);await s.rights(false);const readonlyIdentity=s.identity();await act(()=>{readonlyIdentity.focus();readonlyIdentity.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));});expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(before);expect(s.resistance()).toBe('fire');
 await s.rights(true);const expected=structuredClone(original);removeSelection(expected,f.owner.id);const identity=s.identity();expect(identity.matches(':disabled')).toBe(false);await act(()=>{identity.focus();identity.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));});expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.selections.some(row=>row.id===f.owner.id)).toBe(false);expect(s.resistance()).toBe('无');expect(snapshot(s.c)).toBe(snapshot(expected));await s.reopen();expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.resistance()).toBe('无');expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);expect(s.host.textContent?.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);
});
