// @vitest-environment jsdom
// Authored real component-host edit -> syncFeatures -> native roundtrip flows.
// NOT RUN locally without jsdom; not full App, Inventory or server acceptance.
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
import {syncFeatures} from '../src/core/sheet';
import {createCustomEntry} from '../src/core/customEntries';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {uid,type Character,type Selection} from '../src/core/model';
import {classMovementFixture} from './helpers/classMovementFlowFixture';
import {classMovementSnapshot as snapshot} from './helpers/classMovementSourceFixture';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const noop=()=>{};let dispose:(()=>Promise<void>)|undefined;
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(performance.now()),0));vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));});
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
function gear(c:Character,type:'LA'|'HA'|'S'){const entry=createCustomEntry({name:'Authored movement equipment '+type,type:'armor',body:'',raw:{type,armor:type!=='S',ac:type==='HA'?16:type==='S'?2:11},edition:c.edition}),row:Selection={id:uid(),entry,quantity:1,level:1,equipped:false};c.profile.enabledSources=[...new Set([...c.profile.enabledSources,'CUSTOM'])];c.selections.push(row);return row;}
async function setup(f:ReturnType<typeof classMovementFixture>){
 await dispose?.();let c=f.c,writable=true;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);syncFeatures(draft,f.entries);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){const d=evaluate(c);root?.render(createElement(ValueTraceProvider,{c,d,enabled:writable,children:createElement(SheetEditContext.Provider,{value:writable},createElement('main',null,createElement(Overview,{c,d,catalog:f.entries,statusRibbon:null,addEntry:noop,edit,browse:noop,inspect:noop,renderSelection:()=>null,onLink:noop,openResources:noop,openQuickbar:noop,pinDrop:noop}),createElement(AutomationPanel,{c,d,entries:f.entries,edit,writable})))}));}
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const field=(label:string)=>{const node=host.querySelector<HTMLInputElement>(`input[aria-label=${JSON.stringify(label)}]`);expect(node).not.toBeNull();return node!;};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const walking=()=>Number(host.querySelector('[data-stat=speed]')?.firstChild?.textContent),summary=()=>host.querySelector<HTMLElement>('[data-class-movement-summary]');
 const classLevel=()=>field(f.classEntry.name+'等级'),equip=(row:Selection)=>field('装备 '+row.entry.name);
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,type,click,walking,summary,classLevel,equip,get c(){return c;},async commit(next:Character){c=next;await render();},async rights(value:boolean){writable=value;await render();}};
}

it('actual native class-level NumberInput and armor/shield checkboxes synchronize real Monk grants and persist their source-owned table values without changing spent state',async()=>{
 const f=classMovementFixture('monk-phb'),light=gear(f.c,'LA'),shield=gear(f.c,'S'),s=await setup(f),protectedBefore=snapshot([s.c.abilities,s.c.notes,s.c.runtime,s.c.sheetBonuses,s.c.skillBonuses,s.c.saveBonuses]);expect(s.walking()).toBe(43);expect(s.summary()?.querySelector('[data-testid=class-movement-walking]')?.textContent).toBe('43');expect(s.summary()?.querySelector('input,button,select,textarea')).toBeNull();const level=s.classLevel();expect(level.value).toBe('2');await act(()=>level.focus());await s.type(level,'6');expect(s.edit).not.toHaveBeenCalled();await act(()=>level.blur());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.selections.find(row=>row.id===f.owner.id)!.level).toBe(6);expect(s.walking()).toBe(48);expect(s.c.selections.filter(row=>row.parentId===f.owner.id&&row.grantKey===f.rule.grantKey).length).toBe(1);
 expect(s.equip(light).matches(':disabled')).toBe(false);await s.click(s.equip(light));expect(s.walking()).toBe(33);await s.click(s.equip(shield));expect(s.walking()).toBe(33);await s.click(s.equip(light));expect(s.walking()).toBe(33);await s.click(s.equip(shield));expect(s.walking()).toBe(48);expect(s.edit).toHaveBeenCalledTimes(5);expect(snapshot([s.c.abilities,s.c.notes,s.c.runtime,s.c.sheetBonuses,s.c.skillBonuses,s.c.saveBonuses])).toBe(protectedBefore);expect(snapshot(readCharacter(exportCharacter(s.c)).character)).toBe(snapshot(s.c));
 const down=s.classLevel();await act(()=>down.focus());await s.type(down,'1');await act(()=>down.blur());expect(s.edit).toHaveBeenCalledTimes(6);expect(s.walking()).toBe(33);expect(s.c.selections.some(row=>row.parentId===f.owner.id&&row.grantKey===f.rule.grantKey)).toBe(false);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.resources.manual.current).toBe(1);
});

it('the actual Ranger heavy equip path keeps swim/climb at manual final50, and readonly source/level changes never turn the walking restriction into a mode restriction or write incoming data',async()=>{
 const f=classMovementFixture('ranger-xphb'),heavy=gear(f.c,'HA');f.c.adjustments=[{id:'authored-final-walk',target:'speed',value:47,reason:'Authored final walking'}];const s=await setup(f);expect(s.walking()).toBe(50);for(const mode of ['swim','climb'])expect(s.summary()?.querySelector(`[data-testid="class-movement-${mode}"]`)?.textContent).toBe('50');await s.click(s.equip(heavy));expect(s.edit).toHaveBeenCalledTimes(1);expect(s.c.selections.find(row=>row.id===heavy.id)!.equipped).toBe(true);expect(s.walking()).toBe(50);for(const mode of ['swim','climb'])expect(s.summary()?.querySelector(`[data-testid="class-movement-${mode}"]`)?.textContent).toBe('50');expect(snapshot(readCharacter(exportCharacter(s.c)).character)).toBe(snapshot(s.c));await s.rights(false);const original=structuredClone(s.c),before=snapshot(s.c);expect(s.equip(heavy).matches(':disabled')).toBe(true);expect(s.classLevel().readOnly).toBe(true);expect(s.summary()?.querySelector('input,button,select,textarea')).toBeNull();await s.click(s.equip(heavy));expect(s.edit).toHaveBeenCalledTimes(1);expect(snapshot(s.c)).toBe(before);
 // Supplied readonly state transitions, not invented source or Inventory controls.
 for(const mode of ['source','level']as const){const c=structuredClone(original);if(mode==='source')c.profile.enabledSources=c.profile.enabledSources.filter(source=>source!==f.classEntry.source);else{c.selections.find(row=>row.id===f.owner.id)!.level=5;syncFeatures(c,f.entries);}const incoming=snapshot(c);await s.commit(c);expect(s.walking()).toBe(50);expect(s.host.querySelector('[data-testid=class-movement-swim]')).toBeNull();expect(s.host.querySelector('[data-testid=class-movement-climb]')).toBeNull();expect(s.edit).toHaveBeenCalledTimes(1);expect(snapshot(s.c)).toBe(incoming);}
});
