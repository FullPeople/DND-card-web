import {beforeAll,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {transformWithOxc} from 'vite';

type Node={type:any;props:Record<string,any>;children:any[]};
let code:string;
beforeAll(async()=>{
 const source=readFileSync(new URL('../src/ui/WorkbenchConsole.tsx',import.meta.url),'utf8');
 const start=source.indexOf('function ConsoleContent()'),end=source.indexOf('\nfunction ResourceOverview()',start);
 expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
 code=(await transformWithOxc(source.slice(start,end),'WorkbenchConsole.tsx',{jsx:{runtime:'classic'}})).code;
});
// Exercise the actual component's rendered event handlers with deterministic
// hook slots. This supplements, and does not replace, the browser regression.
function fixture(){
 const wb={role:'GM',online:true,enabled:{transitions:true,inventory:false,resourceTracker:false}},slots:any[]=[];
 let index=0;
 const useState=(initial:any)=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
 const useRef=(initial:any)=>{const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];};
 const request=vi.fn(()=>Promise.resolve({}));
 const React={createElement:(type:any,props:any,...children:any[]):Node=>({type,props:props||{},children})};
 const renderComponent=new Function('React','useState','useRef','useWorkbench','useActionHistory','workbenchRequest','travelHistory','GroupRollArea','PreferenceSwitch','WorkbenchInventory','PublicResources','ResourceOverview',code+';return ConsoleContent;')(React,useState,useRef,()=>wb,()=>({}),request,vi.fn(),()=>null,()=>null,()=>null,()=>null,()=>null);
 const render=()=>{index=0;return renderComponent() as Node;};
 const nodes=(value:any):Node[]=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'&&value.props?[value,...nodes(value.children)]:[];
 const label=(value:any):string=>Array.isArray(value)?value.map(label).join(''):value&&typeof value==='object'?label(value.children):String(value??'');
 const button=(name:string)=>nodes(render()).find(n=>n.type==='button'&&label(n.children)===name)!;
 return {wb,request,render,nodes,button};
}
describe('overview rest presentation controls',()=>{
 it('restores the two presentation choices and original default without a selected character',()=>{
  const f=fixture();for(const name of ['短休','长休','文字'])expect(f.button(name)).toBeDefined();expect(f.button('短休').props['aria-pressed']).toBe(true);
  f.button('长休').props.onClick();expect(f.button('长休').props['aria-pressed']).toBe(true);expect(f.request).not.toHaveBeenCalled();
 });
 it.each([['short','短休'],['long','长休']])('sends %s through the existing presentation route only',async(kind,name)=>{
  const f=fixture();f.button(name).props.onClick();f.button('自己预览').props.onClick();
  expect(f.request).toHaveBeenCalledWith('console',{action:'transitions',kind,text:'经过了一段时间...',preview:true});
  await vi.waitFor(()=>expect(f.button('播放转场').props.disabled).toBe(false));f.button('播放转场').props.onClick();
  expect(f.request).toHaveBeenLastCalledWith('console',{action:'transitions',kind,text:'经过了一段时间...',preview:false});expect(f.request).toHaveBeenCalledTimes(2);
 });
 it('blocks same-render double clicks and holds both actions until acknowledgement',async()=>{
  const f=fixture();let resolve!:()=>void;f.request.mockImplementation(()=>new Promise(r=>{resolve=()=>r({});}));
  const play=f.button('播放转场');play.props.onClick();play.props.onClick();
  expect(f.request).toHaveBeenCalledTimes(1);expect(f.button('自己预览').props.disabled).toBe(true);expect(f.button('播放转场').props.disabled).toBe(true);
  resolve();await vi.waitFor(()=>expect(f.button('播放转场').props.disabled).toBe(false));expect(f.request).toHaveBeenCalledTimes(1);
 });
 it('does not retry failures automatically and unlocks explicit retry',async()=>{
  const f=fixture();f.request.mockRejectedValueOnce(Error('转场未能启动'));f.button('播放转场').props.onClick();
  await vi.waitFor(()=>expect(f.button('播放转场').props.disabled).toBe(false));expect(f.request).toHaveBeenCalledTimes(1);
  expect(f.nodes(f.render()).some(n=>n.props.role==='alert'&&n.children.includes('Error: 转场未能启动'))).toBe(true);
  f.button('自己预览').props.onClick();expect(f.request).toHaveBeenCalledTimes(2);
 });
 it('keeps player and module visibility gates, offline safety, and custom text',()=>{
  const f=fixture();f.wb.role='PLAYER';expect(f.button('短休')).toBeUndefined();f.wb.role='GM';f.wb.enabled.transitions=false;expect(f.button('长休')).toBeUndefined();
  f.wb.enabled.transitions=true;f.wb.online=false;expect(f.button('播放转场').props.disabled).toBe(true);f.button('播放转场').props.onClick();expect(f.request).not.toHaveBeenCalled();
  f.wb.online=true;f.button('文字').props.onClick();const input=f.nodes(f.render()).find(n=>n.type==='input'&&n.props['aria-label']==='转场文字')!;input.props.onChange({target:{value:' 翌日清晨 '}});f.button('播放转场').props.onClick();expect(f.request).toHaveBeenCalledWith('console',{action:'transitions',kind:'text',text:'翌日清晨',preview:false});
 });
});
