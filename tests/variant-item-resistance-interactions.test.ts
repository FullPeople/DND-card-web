// @vitest-environment jsdom
// Authored actual AutomationPanel equipment/readonly interactions. NOT RUN
// locally without jsdom; supplied source/owner props are not Inventory/App proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/platform/workbench',()=>{const state={};return{inWorkbench:false,useWorkbench:()=>state,getWorkbench:()=>state,workbenchRequest:vi.fn(),requestInventory:vi.fn(),composeRoll:vi.fn()};});
vi.mock('../src/cloud/localRights',()=>({localGm:()=>false}));
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {evaluate} from '../src/core/engine';
import type {Character} from '../src/core/model';
import {variantItemResistanceBonusFixture} from './helpers/variantItemResistanceBonusFlowFixture';
import {variantItemResistanceBonusSpecs,variantItemResistanceBonusSnapshot as snapshot} from './helpers/variantItemResistanceBonusSourceFixture';
import {itemResistanceBonusFixture} from './helpers/itemResistanceBonusFlowFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(f=variantItemResistanceBonusFixture(),writable=true){
 await dispose?.();let c=f.c;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=draft;draw();});
 function draw(){root?.render(createElement(AutomationPanel,{c,d:evaluate(c),entries:f.entries,edit,writable}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const equipment=()=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify('装备 '+f.entry.name)}]`);expect(node).not.toBeNull();return node!;};
 const resistance=()=>host.querySelector('[data-testid=automation-resistances]')?.textContent;
 const reasons=()=>{const issues=evaluate(c).issues.filter(issue=>issue.id.startsWith('variant-item-resistance-bonus:'));expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(host.textContent?.includes(issue.message)).toBe(true);};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,equipment,resistance,reasons,click,get c(){return c;},async commit(next:Character){c=next;await render();},async rights(value:boolean){writable=value;await render();}};
}

it('the genuine armor equipment checkbox changes only its physical mark and resistance, preserving the existing typed Ring union, ordinary AC path and manual resources',async()=>{
 const f=variantItemResistanceBonusFixture(),ring=itemResistanceBonusFixture(f.spec.resistance==='fire'?1752:1775);f.c.selections.push(structuredClone(ring.owner));f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,...ring.c.profile.enabledSources])];f.entries.push(ring.entry);const s=await setup(f),before=structuredClone(s.c),expected=[f.spec.resistance,ring.spec.resistance].sort(),originalAc=evaluate(s.c).ac;expect([...evaluate(s.c).resistances!].sort()).toEqual(expected);expect(s.resistance()?.split('、').sort()).toEqual(expected);expect(s.host.textContent?.includes(f.entry.name)).toBe(true);expect(s.host.textContent?.includes(ring.entry.name)).toBe(true);const off=structuredClone(before);off.selections.find(row=>row.id===f.owner.id)!.equipped=false;await s.click(s.equipment());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.resistance()).toBe(ring.spec.resistance);expect(snapshot(s.c)).toBe(snapshot(off));s.reasons();expect(Number(s.host.querySelector('[data-testid=automation-ac]')?.textContent)).toBe(evaluate(off).ac);await s.click(s.equipment());expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(snapshot(before));expect(evaluate(s.c).ac).toBe(originalAc);expect(s.resistance()?.split('、').sort()).toEqual(expected);await s.rights(false);const readonly=snapshot(s.c);expect(s.equipment().matches(':disabled')).toBe(true);await s.click(s.equipment());expect(s.edit).toHaveBeenCalledTimes(2);expect(snapshot(s.c)).toBe(readonly);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);expect(s.host.textContent?.includes('实际伤害结算与减免仍需手动处理，不会自动改写生命值')).toBe(true);
});

it('readonly actual components keep qualified SCAG/provenance and transport aliases separate from final-source/concrete controls without inventing prerequisite owners or writing incoming state',async()=>{
 const spec=variantItemResistanceBonusSpecs.find(row=>row.baseHeader.source==='SCAG')||variantItemResistanceBonusSpecs[0],f=variantItemResistanceBonusFixture(spec.key),canonical=f.entry.id;f.entry.id='authored-mounted-variant-alias';f.c.profile.enabledSources=[f.entry.source,...(f.entry.dependencies||[])];f.c.profile.disabledEntries=[f.rule.baseProof.normalized.id,f.rule.templateProof.normalized.id];const s=await setup(f,false),original=structuredClone(s.c),before=snapshot(s.c);expect(s.c.selections.length).toBe(1);expect(s.resistance()).toBe(spec.resistance);expect(s.equipment().matches(':disabled')).toBe(true);await s.click(s.equipment());expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(before);
 // Explicit incoming card-state changes, not fabricated Inventory gestures.
 for(const mode of ['source','canonical','alias','attunement']as const){const c=structuredClone(original);if(mode==='source')c.profile.enabledSources=[];if(mode==='canonical')c.profile.disabledEntries=[canonical];if(mode==='alias')c.profile.disabledEntries=[f.entry.id];if(mode==='attunement')c.selections.find(row=>row.id===f.owner.id)!.attuned=false;const incoming=snapshot(c);await s.commit(c);expect(s.resistance()).toBe('无');s.reasons();expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(incoming);}
 await s.commit(original);expect(s.resistance()).toBe(spec.resistance);expect(snapshot(s.c)).toBe(before);expect(s.edit).not.toHaveBeenCalled();
});
