// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {CustomEntryEditor} from '../src/ui/CustomEntryEditor';
import {createCustomEntry} from '../src/core/customEntries';
vi.mock('../src/ui/CustomEntryCanvas',()=>({CustomEntryCanvas:(p:any)=>createElement('button',{'aria-label':'authored change',onClick:()=>p.identity('name',p.name+'x')},p.name)}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>vi.restoreAllMocks());
it('field typing does not rebuild hidden full JSON, and opening JSON uses the latest lossless draft',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),draft=createCustomEntry({name:'Authored',type:'item',body:'Authored fixture',entries:['literal',{type:'entries',name:'nested',entries:['kept']}],raw:{future:{preserve:1}},edition:'2024'}),save=vi.fn(async()=>{});
 try{await act(()=>root.render(createElement(CustomEntryEditor,{draft,busy:false,save,remove:async()=>{},newEntry:()=>{}})));const stringify=vi.spyOn(JSON,'stringify');
 for(let n=0;n<3;n++)await act(()=>{host.querySelector<HTMLButtonElement>('[aria-label="authored change"]')!.click();});
 const fullDraftCalls=stringify.mock.calls.filter(([value])=>value&&typeof value==='object'&&'english' in value&&'entries' in value&&'raw' in value&&'type' in value);
 expect(fullDraftCalls).toHaveLength(0);await act(()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='JSON 输入')!.click();});
 const value=JSON.parse(host.querySelector<HTMLTextAreaElement>('[aria-label="完整自定义条目 JSON"]')!.value);expect(value.name).toBe('Authoredxxx');expect(value.entries).toEqual(draft.entries);expect(value.raw.future).toEqual({preserve:1});expect(save).not.toHaveBeenCalled();
 }finally{await act(()=>root.unmount());host.remove();}
});
