// @vitest-environment jsdom
// Authored actual component-host controls plus native serialize/read boundaries.
// NOT RUN locally without jsdom; not full App, drag, server or inventory proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
// Display-only peripherals are outside these real Overview/Panel interactions.
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
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSnapshot as snapshot} from './helpers/racialResistanceSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
const order=['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'];
const display=(types:readonly string[])=>order.filter(type=>types.includes(type)).join('、')||'无';
async function setup(f:ReturnType<typeof racialResistanceFixture>){
 await dispose?.();let c=f.c,writable=true;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.entries,edit,writable})))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const resistance=()=>host.querySelector('[data-testid=automation-resistances]')?.textContent;
 const identity=()=>{const rows=[...host.querySelectorAll<HTMLElement>('.identity-token')].filter(node=>node.dataset.selectionId===f.owner.id);expect(rows.length).toBe(1);const button=rows[0].querySelector<HTMLButtonElement>('button.identity-title');expect(button).not.toBeNull();expect(button!.getAttribute('data-reference')).toBe(`race:entry:${f.entry.id}`);return button!;};
 const reasons=()=>{const issues=evaluate(c).issues.filter(issue=>issue.id.startsWith('racial-resistance:'));expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(host.textContent?.includes(issue.message)).toBe(true);};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,type,click,identity,resistance,reasons,get c(){return c;},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;await render();},async rights(value:boolean){writable=value;await render();}};
}

it('the actual automation checkbox and focused native race identity Delete revoke and restore only the derived union through native reopening, while readonly blocks both real controls',async()=>{
 const f=racialResistanceFixture(),s=await setup(f),original=structuredClone(s.c),before=snapshot(s.c),toggle=()=>s.field('启用自动计算');expect(s.resistance()).toBe(display(f.spec.resistances));expect(s.host.textContent?.includes(f.entry.name)).toBe(true);const disabled=structuredClone(original);disabled.automation!.enabled=false;await s.click(toggle());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.resistance()).toBe('无');s.reasons();expect(snapshot(s.c)).toBe(snapshot(disabled));await s.reopen();expect(s.resistance()).toBe('无');expect(snapshot(s.c)).toBe(snapshot(disabled));await s.click(toggle());expect(s.edit).toHaveBeenCalledTimes(2);expect(s.resistance()).toBe(display(f.spec.resistances));expect(snapshot(s.c)).toBe(before);
 await s.rights(false);expect(toggle().matches(':disabled')).toBe(true);await s.click(toggle());const readonlyIdentity=s.identity();await act(()=>{readonlyIdentity.focus();readonlyIdentity.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));});expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(before);expect(s.resistance()).toBe(display(f.spec.resistances));
 await s.rights(true);const expected=structuredClone(original);removeSelection(expected,f.owner.id);const identity=s.identity();expect(identity.matches(':disabled')).toBe(false);await act(()=>{identity.focus();identity.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));});expect(s.edit).toHaveBeenCalledTimes(3);expect(s.c.selections.some(row=>row.id===f.owner.id)).toBe(false);expect(s.resistance()).toBe('无');expect(snapshot(s.c)).toBe(snapshot(expected));await s.reopen();expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.resistance()).toBe('无');expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);
});

it('the real Overview HP arithmetic remains literal9 minus4 equals5, and readonly source or canonical disable transitions neither halve damage nor rewrite retained snapshots',async()=>{
 const f=racialResistanceFixture();f.c.baseHp=20;f.c.runtime.hp=9;const s=await setup(f),expected=structuredClone(s.c);expected.runtime.hp=5;const hp=s.field('当前生命值');expect(hp.value).toBe('9');expect(s.resistance()).toBe(display(f.spec.resistances));await act(()=>hp.focus());await s.type(hp,'-4');expect(s.edit).not.toHaveBeenCalled();await act(()=>hp.blur());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.field('当前生命值').value).toBe('5');expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);expect(s.resistance()).toBe(display(f.spec.resistances));expect(s.host.textContent?.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);await s.reopen();expect(snapshot(s.c)).toBe(snapshot(expected));await s.rights(false);
 // Incoming readonly props, not invented source-switch or Inventory gestures.
 for(const mode of ['source','canonical']as const){const c=structuredClone(expected);if(mode==='source')c.profile.enabledSources=[];else c.profile.disabledEntries=[f.entry.id];const incoming=snapshot(c);await s.commit(c);expect(s.resistance()).toBe('无');s.reasons();expect(s.c.runtime.hp).toBe(5);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);expect(s.edit).toHaveBeenCalledTimes(1);expect(snapshot(s.c)).toBe(incoming);await s.reopen();expect(snapshot(s.c)).toBe(incoming);}
});
