import {afterEach,beforeEach,expect,it,vi} from 'vitest';

const hooks=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,ref:undefined as undefined|{current:unknown}}));
vi.mock('react',()=>({useRef:(value:unknown)=>hooks.ref??(hooks.ref={current:value}),useEffect:(effect:()=>void|(()=>void))=>{if(!hooks.effects.length)hooks.effects.push(effect);}}));
import {useNarrowWikiDrag} from '../src/ui/useNarrowWikiDrag';

class TestElement{constructor(private matches:string[]=[]){ }closest(selector:string){return this.matches.includes(selector)?this:null;}}
class Events{
 listeners=new Map<string,Set<(event:any)=>void>>();
 addEventListener(type:string,fn:(event:any)=>void){const set=this.listeners.get(type)??new Set();set.add(fn);this.listeners.set(type,set);}
 removeEventListener(type:string,fn:(event:any)=>void){this.listeners.get(type)?.delete(fn);}
 emit(type:string,event:unknown={}){for(const fn of this.listeners.get(type)??[])fn(event);}
 count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
let win:Events,doc:Events,cleanup:void|(()=>void),narrow=true;
beforeEach(()=>{hooks.effects=[];hooks.ref=undefined;narrow=true;win=new Events();doc=new Events();vi.stubGlobal('window',win);vi.stubGlobal('document',doc);vi.stubGlobal('Element',TestElement);vi.stubGlobal('matchMedia',()=>({matches:narrow}));});
afterEach(()=>{cleanup?.();cleanup=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
function mount(tab='wiki',visible=true){const change=vi.fn();useNarrowWikiDrag(tab,change,visible);cleanup=hooks.effects[0]();return change;}
function start(wiki=true){win.emit('card-drag-start',{detail:{source:new TestElement(wiki?['.wiki-pane']:[])}});}
function navigate(mobile=true){doc.emit('click',{target:new TestElement(mobile?['.mobile-tabs button']:[])});}

it('keeps the explicit mobile page after a late landing notification',()=>{
 const change=mount();start();expect(change.mock.calls).toEqual([['sheet']]);navigate();win.emit('card-drag-end');expect(change.mock.calls).toEqual([['sheet']]);
});
it('still returns to Wiki when no explicit navigation happened',()=>{
 const change=mount();start();win.emit('card-drag-end');expect(change.mock.calls).toEqual([['sheet'],['wiki']]);
});
it('does not treat unrelated clicks as a page decision',()=>{
 const change=mount();start();navigate(false);win.emit('card-drag-end');expect(change.mock.calls).toEqual([['sheet'],['wiki']]);
});
it.each([{tab:'sheet',visible:true,narrow:true,wiki:true},{tab:'wiki',visible:false,narrow:true,wiki:true},{tab:'wiki',visible:true,narrow:false,wiki:true},{tab:'wiki',visible:true,narrow:true,wiki:false}])('leaves inapplicable gestures alone: %j',options=>{
 narrow=options.narrow;const change=mount(options.tab,options.visible);start(options.wiki);navigate();win.emit('card-drag-end');expect(change).not.toHaveBeenCalled();
});
it('a new drag gets its own default return after an earlier explicit decision',()=>{
 const change=mount();start();navigate();win.emit('card-drag-end');start();win.emit('card-drag-end');expect(change.mock.calls).toEqual([['sheet'],['sheet'],['wiki']]);
});
it('uses the current callback after a render, without adding listeners',()=>{
 const first=mount();start();const next=vi.fn();useNarrowWikiDrag('sheet',next,true);win.emit('card-drag-end');expect(first.mock.calls).toEqual([['sheet']]);expect(next.mock.calls).toEqual([['wiki']]);expect(win.count()).toBe(2);
});
it('removes the pending return and all navigation listeners on unmount',()=>{
 const change=mount();start();cleanup?.();cleanup=undefined;expect(win.count()).toBe(0);expect(doc.count()).toBe(0);win.emit('card-drag-end');expect(change.mock.calls).toEqual([['sheet']]);
});
it('does no navigation lookup on normal clicks before or after a drag landing',()=>{
 mount();const closest=vi.spyOn(TestElement.prototype,'closest');navigate(false);expect(closest).not.toHaveBeenCalled();
 start();expect(doc.count()).toBe(1);win.emit('card-drag-end');closest.mockClear();navigate(false);expect(closest).not.toHaveBeenCalled();expect(doc.count()).toBe(0);closest.mockRestore();
});
it('releases the click listener immediately after an explicit page decision',()=>{
 mount();expect(doc.count()).toBe(0);start();expect(doc.count()).toBe(1);navigate();expect(doc.count()).toBe(0);win.emit('card-drag-end');expect(doc.count()).toBe(0);
});
