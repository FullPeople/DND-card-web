// @vitest-environment jsdom
// Authored real CarryCapacity field and SheetEditContext, no component/provider
// mocks. NOT RUN locally without jsdom; not full App, Inventory or server proof.
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {CarryCapacity} from '../src/ui/InventoryMarks';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {evaluate} from '../src/core/engine';
import {carrying} from '../src/core/carrying';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import type {Character} from '../src/core/model';
import {racialCarryingFixture} from './helpers/racialCarryingFlowFixture';
import {racialCarryingSnapshot as snapshot} from './helpers/racialCarryingSourceFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let dispose:(()=>Promise<void>)|undefined;
afterEach(async()=>{await dispose?.();dispose=undefined;vi.restoreAllMocks();});
async function setup(initial:Character){
 await dispose?.();let c=initial,writable=true,session=0;const host=document.createElement('div');document.body.append(host);let root:Root|undefined=createRoot(host);
 const edit=vi.fn((fn:(draft:Character)=>void)=>{const draft=structuredClone(c);fn(draft);c=readCharacter(exportCharacter(draft)).character;draw();});
 function draw(){root?.render(createElement(SheetEditContext.Provider,{value:writable},createElement(CarryCapacity,{key:c.id+':'+session,c,d:evaluate(c),edit})));}
 const render=async()=>{c={...c};await act(draw);};
 const field=()=>{const node=host.querySelector<HTMLInputElement>('input[aria-label="负重上限调整"]');expect(node).not.toBeNull();return node!;};
 const type=async(node:HTMLInputElement,value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
 const max=()=>host.querySelector('.capacity-adjuster > b')?.textContent;
 const notes=()=>{const node=host.querySelector('[role="note"][aria-label="负重来源说明"]'),values=carrying(c,evaluate(c));expect(node).not.toBeNull();expect(values.sourceNotes.length).toBeGreaterThan(0);for(const line of values.sourceNotes)expect(node?.textContent?.includes(line)).toBe(true);};
 dispose=async()=>{if(root)await act(()=>root!.unmount());root=undefined;host.remove();};await render();return{host,edit,field,type,max,notes,get c(){return c;},async rights(value:boolean){writable=value;await render();},async commit(next:Character){c=next;await render();},async reopen(){c=readCharacter(exportCharacter(c)).character;session++;await render();}};
}

it('explicitly clearing the real manual formula stores only that authored change and reveals the authenticated automatic capacity without silently doubling a retained multiplier',async()=>{
 const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment='*2+30';const s=await setup(f.c),before=structuredClone(s.c),expected=structuredClone(s.c);expected.inventory!.capacityAdjustment='';expect(s.max()).toBe('330');expect(s.field().value).toBe('*2+30');s.notes();expect(s.edit).not.toHaveBeenCalled();const field=s.field();await act(()=>field.focus());await s.type(field,'');expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(snapshot(before));await act(()=>field.blur());expect(s.edit).toHaveBeenCalledTimes(1);expect(s.max()).toBe('300');expect(s.field().value).toBe('');s.notes();expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.c.size).toBe('M');expect(evaluate(s.c).abilities.str).toBe(10);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);await s.reopen();expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.max()).toBe('300');
 const manual=s.field();await act(()=>manual.focus());await s.type(manual,'*2');await act(()=>manual.blur());expect(s.edit).toHaveBeenCalledTimes(2);expected.inventory!.capacityAdjustment='*2';expect(snapshot(s.c)).toBe(snapshot(expected));expect(s.max()).toBe('300');expect(carrying(s.c,evaluate(s.c)).base).toBe(150);s.notes();await s.reopen();expect(s.field().value).toBe('*2');expect(s.max()).toBe('300');expect(snapshot(s.c)).toBe(snapshot(expected));
});

it('the actual formula validator refuses an invalid draft, and current readonly or source opt-outs preserve the saved formula and complete native state without automatic edits',async()=>{
 const f=racialCarryingFixture();f.c.inventory!.capacityAdjustment='*2';const s=await setup(f.c),original=structuredClone(s.c),before=snapshot(s.c),field=s.field();await act(()=>field.focus());await s.type(field,'window.alert(1)');await act(()=>field.blur());expect(s.edit).not.toHaveBeenCalled();expect(s.host.querySelector('[role=alert]')?.textContent?.includes('请输入数字、基础、力量和四则运算')).toBe(true);expect(s.max()).toBe('300');expect(snapshot(s.c)).toBe(before);await s.reopen();expect(s.field().value).toBe('*2');expect(s.host.querySelector('[role=alert]')).toBeNull();expect(snapshot(s.c)).toBe(before);
 await s.rights(false);expect(s.host.querySelector('input[aria-label="负重上限调整"]')).toBeNull();s.notes();expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(before);
 // Incoming readonly state, not invented source-switch or lock widgets.
 for(const mode of ['source','canonical']as const){const c=structuredClone(original);c.locked=true;if(mode==='source')c.profile.enabledSources=[];else c.profile.disabledEntries=[f.entry.id];const incoming=snapshot(c);await s.commit(c);expect(s.max()).toBe((evaluate(c).abilities.str*15*2).toLocaleString());expect(s.c.inventory!.capacityAdjustment).toBe('*2');expect(s.host.querySelector('input')).toBeNull();s.notes();expect(s.edit).not.toHaveBeenCalled();expect(snapshot(s.c)).toBe(incoming);expect(s.c.runtime.hp).toBe(3);expect(s.c.runtime.tempHp).toBe(2);expect(s.c.runtime.resources.manual.current).toBe(1);await s.reopen();expect(snapshot(s.c)).toBe(incoming);}
});
