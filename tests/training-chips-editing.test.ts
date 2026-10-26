import {createElement,act} from 'react';
import {beforeAll,afterAll,beforeEach,afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import type {Root} from 'react-dom/client';
vi.mock('../src/ui/SheetEdit',async()=>({SheetEditContext:(await import('react')).createContext(false)}));
vi.mock('../src/ui/Reference',async()=>({ReferenceContext:(await import('react')).createContext(undefined),Reference:({children,onClick}:any)=>createElement('button',{onClick},children)}));
vi.mock('../src/ui/Entries',()=>({Inline:({text}:any)=>createElement('span',null,text)}));
vi.mock('../src/ui/pointerDrag',()=>({pointerDrag:()=>()=>{},landingWithin:()=>({})}));
import {TrainingChips} from '../src/ui/TrainingChips';
import {SheetEditContext} from '../src/ui/SheetEdit';
// Real React DOM focus/blur tests, not browser/layout acceptance. The locked
// jsdom dev dependency is required in CI; these tests never silently skip.
const {JSDOM}=createRequire(import.meta.url)('jsdom');
let dom:any,root:Root,createRoot:typeof import('react-dom/client')['createRoot'],host:HTMLDivElement;
beforeAll(async()=>{dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.test/',pretendToBeVisual:true});for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Event','FocusEvent','MouseEvent','KeyboardEvent'])vi.stubGlobal(key,key==='window'?dom.window:dom.window[key]);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);({createRoot}=await import('react-dom/client'));});
beforeEach(()=>{host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
afterAll(()=>{dom.window.close();vi.unstubAllGlobals();});
const field=(label:string)=>host.querySelector(`input[aria-label="${label}熟练记录"]`) as HTMLInputElement;
async function render(value='light',onChange=vi.fn(),allowed=true,editAll=true,identity='card-a'){await act(async()=>root.render(createElement(SheetEditContext.Provider,{value:allowed},createElement(TrainingChips,{key:identity,label:'护甲',group:'armor',source:'PHB',value,onChange,editAll}))));return onChange;}
async function focus(input:HTMLElement){await act(async()=>input.focus());}
async function blur(input:HTMLElement){await act(async()=>input.blur());}
async function type(input:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
async function key(input:HTMLInputElement,key:string){await act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true})));}

it('opening all training fields and moving actual focus does not save empty or nonempty unedited projections',async()=>{
 const writes=vi.fn();await act(async()=>root.render(createElement(SheetEditContext.Provider,{value:true},createElement('div',null,...[['护甲','armor','light'],['武器','weapons',''],['工具','tools','手工工具'],['语言','languages','手工语言']].map(([label,group,value])=>createElement(TrainingChips,{key:group,label,group,source:'PHB',value,editAll:true,onChange:next=>writes(group,next)}))))));
 for(const label of ['护甲','武器','工具','语言'])await focus(field(label));await blur(field('语言'));expect(writes).not.toHaveBeenCalled();
});
it('a deliberate empty edit saves exactly once despite Enter followed by actual blur',async()=>{const writes=await render();const input=field('护甲');await type(input,'');await key(input,'Enter');await blur(input);expect(writes.mock.calls).toEqual([['']]);});
it('Escape restores the value and a later actual blur never commits the cancelled draft',async()=>{const writes=await render();const input=field('护甲');await type(input,'shield');await key(input,'Escape');await blur(input);expect(writes).not.toHaveBeenCalled();expect(input.value).toBe('light');await key(input,'Enter');await blur(input);expect(writes.mock.calls).toEqual([['light']]);});
it('a changed field saves once on blur and a later refocus/blur without editing stays clean',async()=>{const writes=await render();const input=field('护甲');await type(input,'shield');await blur(input);await focus(input);await blur(input);expect(writes.mock.calls).toEqual([['shield']]);});
it('revoked write permission cannot commit a pending draft on blur',async()=>{const writes=await render();const input=field('护甲');await type(input,'shield');await render('light',writes,false);await blur(input);await render('light',writes,true);await blur(field('护甲'));expect(writes).not.toHaveBeenCalled();expect(field('护甲').value).toBe('light');});
it('an external value update discards a stale draft and does not write it back on blur',async()=>{const writes=await render();const input=field('护甲');await type(input,'shield');await render('medium',writes);await blur(field('护甲'));expect(writes).not.toHaveBeenCalled();expect(field('护甲').value).toBe('medium');});

it('closing and reopening all-field editing discards an unfinished draft rather than committing on the next blur',async()=>{const writes=await render();await type(field('护甲'),'shield');await render('light',writes,true,false);await render('light',writes,true,true);await blur(field('护甲'));expect(writes).not.toHaveBeenCalled();expect(field('护甲').value).toBe('light');});

it('typing back to the committed value before blur does not create an override',async()=>{const writes=await render();const input=field('护甲');await type(input,'shield');await type(input,'light');await blur(input);expect(writes).not.toHaveBeenCalled();});
it('the card-owned React key discards a draft when the next card has the same displayed value',async()=>{const oldWrites=await render(),oldInput=field('护甲');await type(oldInput,'shield');const newWrites=vi.fn();await render('light',newWrites,true,true,'card-b');expect(field('护甲')).not.toBe(oldInput);expect(field('护甲').value).toBe('light');await blur(field('护甲'));expect(oldWrites).not.toHaveBeenCalled();expect(newWrites).not.toHaveBeenCalled();});

it.each(['light',''])('explicit Enter can deliberately freeze an unchanged displayed value %j exactly once before blur',async value=>{const writes=await render(value),input=field('护甲');await key(input,'Enter');await blur(input);expect(writes.mock.calls).toEqual([[value]]);});
