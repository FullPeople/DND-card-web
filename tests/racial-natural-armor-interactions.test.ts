// @vitest-environment jsdom
// Authored actual Overview/AutomationPanel/provider flows; NOT RUN locally
// without jsdom. Not full App, every child component, Inventory or server proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/ui/TrainingChips',()=>({TrainingChips:()=>null}));
vi.mock('../src/ui/HitDiceResources',()=>({HitDiceResources:()=>null}));
vi.mock('../src/ui/Quickbar',()=>({Quickbar:()=>null}));
vi.mock('../src/ui/Portrait',()=>({Portrait:()=>null}));
vi.mock('../src/ui/FeaturePanel',()=>({FeaturePanel:()=>null}));
vi.mock('../src/ui/OverviewChoiceOverlay',()=>({OverviewChoiceOverlay:()=>null}));
import {Overview} from '../src/ui/Overview';
import {AutomationPanel} from '../src/ui/AutomationPanel';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {ValueTraceProvider} from '../src/ui/ValueTrace';
import {evaluate} from '../src/core/engine';
import {armorAdjustmentReview,resolveLegacyArmorAdjustments} from '../src/core/armorAdjustments';
import {createCustomEntry} from '../src/core/customEntries';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {uid,type Character,type Selection} from '../src/core/model';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSnapshot as snapshot} from './helpers/racialNaturalArmorSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();});
async function setup(f:ReturnType<typeof racialNaturalArmorFixture>){
 await dispose?.();let c=f.c,writable=true,session=0;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c),entries=c.selections.map(row=>row.entry);root?.render(createElement(ValueTraceProvider,{key:c.id+':'+session,c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries,edit,writable})))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const ac=()=>Number(host.querySelector('[data-stat=ac]')?.firstChild?.textContent);
 const reasons=()=>{const issues=evaluate(c).issues.filter(issue=>issue.id.startsWith('racial-natural-armor:'));expect(issues.length).toBeGreaterThan(0);for(const issue of issues)expect(host.textContent?.includes(issue.message)).toBe(true);};
 const restore=()=>{const value=armorAdjustmentReview(c),text=`恢复规则计算（护甲 ${value.ruleTotal+value.previousBonus}）`,buttons=[...host.querySelectorAll<HTMLButtonElement>('[aria-label="护甲调整与旧覆盖核对"] button')].filter(node=>node.textContent===text);expect(buttons.length).toBe(1);return buttons[0];};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,type,click,ac,reasons,restore,get c(){return c;},async rights(value:boolean){writable=value;await render();},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;session++;await render();}};
}

it('the existing manual-AC recovery button preserves a legacy final29 until explicit restore, then the real independent AC offset editor changes only its stored offset',async()=>{
 const f=racialNaturalArmorFixture('race/145');f.c.adjustments=[{id:'authored-final-ac',target:'ac',value:29,reason:'Authored final AC'}];const s=await setup(f),before=snapshot(s.c);expect(s.ac()).toBe(31);await s.rights(false);expect(s.restore().matches(':disabled')).toBe(true);await s.click(s.restore());expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(before);expect(s.ac()).toBe(31);
 await s.rights(true);const expected=structuredClone(s.c);resolveLegacyArmorAdjustments(expected,'restore');await s.click(s.restore());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.ac()).toBe(19);expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.c.armorAdjustmentHistory?.length).toBe(1);expect(s.c.armorAdjustmentHistory?.[0].records[0].value).toBe(29);await s.reopen();expect(s.ac()).toBe(19);expect(snapshot(s.c)).toBe(snapshot(expected));
 const offset=s.field('护甲等级调整值');expect(offset.value).toBe('2');await act(()=>offset.focus());await s.type(offset,'3');expect(s.edit).toHaveBeenCalledTimes(1);await act(()=>offset.blur());expect(s.edit).toHaveBeenCalledTimes(2);expected.sheetBonuses!.ac=3;expect(s.ac()).toBe(20);expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);await s.reopen();expect(s.ac()).toBe(20);expect(snapshot(s.c)).toBe(snapshot(expected));
});

it('the actual equip checkbox blocks an unarmored natural formula for retained physical armor even when its effect source is disabled, without readonly or native-reopen writes',async()=>{
 const f=racialNaturalArmorFixture('race/9'),entry=createCustomEntry({name:'Authored physical natural-AC blocker',type:'armor',body:'',raw:{type:'LA',armor:true,ac:11},edition:f.c.edition}),body:Selection={id:uid(),entry,level:1,quantity:1,equipped:false};f.c.profile.enabledSources.push('CUSTOM');f.c.selections.push(body);const s=await setup(f),before=structuredClone(s.c),checkbox=()=>s.field('装备 '+entry.name);expect(s.ac()).toBe(17);await s.click(checkbox());expect(s.edit).toHaveBeenCalledTimes(1);const expected=structuredClone(before);expected.selections.find(row=>row.id===body.id)!.equipped=true;expect(s.ac()).toBe(15);s.reasons();expect(snapshot(s.c)).toBe(snapshot(expected));await s.reopen();expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.ac()).toBe(15);
 await s.rights(false);expect(checkbox().matches(':disabled')).toBe(true);await s.click(checkbox());expect(s.edit).toHaveBeenCalledTimes(1);expect(snapshot(s.c)).toBe(snapshot(expected));const incoming=structuredClone(expected);incoming.profile.enabledSources=incoming.profile.enabledSources.filter(source=>source!=='CUSTOM');const paused=snapshot(incoming);await s.commit(incoming);expect(s.c.selections.find(row=>row.id===body.id)!.equipped).toBe(true);expect(s.ac()).toBe(14);s.reasons();expect(snapshot(s.c)).toBe(paused);expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);await s.reopen();expect(snapshot(s.c)).toBe(paused);expect(s.ac()).toBe(14);
});
