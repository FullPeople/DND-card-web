import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function boot(reduced=false){
 let now=0;const listeners=new Map<string,Function>(),timeouts:{fn:Function,delay:number}[]=[],intervals:Function[]=[];
 const nodes=new Map<string,any>();
 for(const id of ['startup','startup-title','startup-message','startup-detail','startup-help','startup-retry','startup-intro'])nodes.set(id,{hidden:id==='startup'||id==='startup-help',textContent:'',classList:{add:(name:string)=>nodes.get(id).classes.add(name)},classes:new Set()});
 const icon={href:'',getAttribute:()=> './exe_icon.png'};
 const document={getElementById:(id:string)=>nodes.get(id),querySelector:()=>icon,createElement:()=>({noModule:false})};
 const window={addEventListener:(name:string,fn:Function)=>listeners.set(name,fn)};
 runInNewContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)![1],{document,window,Date:{now:()=>now},navigator:{userAgent:'test'},location:{reload(){}},matchMedia:()=>({matches:reduced}),setTimeout:(fn:Function,delay:number)=>timeouts.push({fn,delay}),setInterval:(fn:Function)=>intervals.push(fn),clearInterval(){}});
 return {nodes,timeouts,emit:(name:string,event:any={})=>listeners.get(name)?.(event),advance:(ms:number)=>{now+=ms;intervals.forEach(fn=>fn());}};
}
describe('approved logo startup contract',()=>{
 it('waits for both the component animation and the real card before fading',()=>{const b=boot();b.emit('dnd-card-ready');expect(b.nodes.get('startup-intro').classes.has('leaving')).toBe(false);expect(b.timeouts[0].delay).toBe(2650);b.timeouts[0].fn();expect(b.nodes.get('startup-intro').classes.has('leaving')).toBe(true);b.timeouts[1].fn();expect(b.nodes.get('startup-intro').hidden).toBe(true);expect(b.nodes.get('startup').hidden).toBe(true);});
 it('keeps the logo when the animation finishes before the workspace',()=>{const b=boot();b.timeouts[0].fn();expect(b.nodes.get('startup-intro').classes.has('leaving')).toBe(false);b.emit('dnd-card-ready');expect(b.nodes.get('startup-intro').classes.has('leaving')).toBe(true);});
 it('offers recovery for slow or failed startup without deleting card storage',()=>{const b=boot();b.advance(21000);expect(b.nodes.get('startup').hidden).toBe(false);expect(b.nodes.get('startup-help').hidden).toBe(false);b.emit('error',{message:'load failed'});expect(b.nodes.get('startup-intro').hidden).toBe(true);expect(b.nodes.get('startup-title').textContent).toBe('程序启动失败');});
 it('honors reduced motion and uses the unchanged four approved PNG layers',()=>{expect(boot(true).timeouts[0].delay).toBe(1);const hashes=['40d81d05690b0fae1bb39c3bfe404aeadf35a7bffc28627bb7fe3685a0e67d26','d876c79b17189f092fb0519479e06109542e2fc84b9315b5212def431140134a','d4094577e2154933d41d43278a05ba899ee27186676f3d5e1ac0aa75454dee41','3b11e47126df35825dc2af8a6f4bfd9cd3000555a0c0d8ae87e1df4d0ad42fee'];hashes.forEach((hash,i)=>expect(createHash('sha256').update(readFileSync(new URL(`../public/startup-logo/${i+1}.PNG`,import.meta.url))).digest('hex')).toBe(hash));expect(html).toContain('background:#FFFF56');expect(html).not.toContain('CHARACTER LOBBY');});
});
