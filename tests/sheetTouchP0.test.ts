import {afterEach,expect,it,vi} from 'vitest';
import {frameLatest,pinchView,sheetTouch,type SheetView} from '../src/ui/sheetTouch';
afterEach(()=>vi.unstubAllGlobals());
it('coalesces 100 touch updates into a single frame and cancels work when switching cards',()=>{
 const frames=new Map<number,FrameRequestCallback>();let id=0;const paint=vi.fn(),q=frameLatest(paint,fn=>{frames.set(++id,fn);return id;},key=>{frames.delete(key);});
 for(let i=0;i<100;i++)q.push(i);expect(frames.size).toBe(1);frames.get(1)!(16);expect(paint.mock.calls).toEqual([[99]]);
 frames.delete(1);q.push(100);q.cancel();expect(frames.size).toBe(0);expect(paint).toHaveBeenCalledOnce();
});
it('keeps the pinch focal point and clamps zoom and translation',()=>{
 const start={distance:100,x:100,y:150,cx:100,cy:150,view:{zoom:1,x:0,y:0}};
 expect(pinchView(start,{distance:200,x:100,y:150},400,800)).toEqual({zoom:2,x:0,y:0});
 expect(pinchView(start,{distance:1000,x:99999,y:-99999},400,800)).toEqual({zoom:3.5,x:500,y:-1000});
 expect(pinchView(start,{distance:10,x:120,y:160},400,800)).toEqual({zoom:1,x:0,y:0});
});
function fixture(initialZoom=1){
 const frames=new Map<number,FrameRequestCallback>();let id=0;vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++id,fn);return id;});vi.stubGlobal('cancelAnimationFrame',(key:number)=>frames.delete(key));vi.stubGlobal('window',new EventTarget());
 const scroller={scrollTop:100,scrollHeight:1000,clientHeight:100,closest:()=>scroller,parentElement:null};
 const root=new EventTarget() as any;root.closest=()=>scroller;root.querySelector=(selector:string)=>selector==='.paper-stack'?root:null;root.getBoundingClientRect=vi.fn(()=>({x:0,y:0,width:400,height:800}));
 let view:SheetView={zoom:initialZoom,x:0,y:0};const commit=vi.fn(),update=vi.fn((next:SheetView)=>view=next),dispose=sheetTouch(root,()=>view,update,commit);
 const touch=(type:string,points:number[][])=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'touches',{value:points.map(([clientX,clientY])=>({clientX,clientY}))});root.dispatchEvent(event);return event;};
 return {touch,frames,commit,update,dispose,scroller,root};
}
it('commits pinch state once at gesture end and suppresses the synthetic click',()=>{
 const f=fixture();f.touch('touchstart',[[100,100],[200,100]]);for(let i=0;i<20;i++)f.touch('touchmove',[[100,100],[250+i,100]]);
 expect(f.commit).not.toHaveBeenCalled();expect(f.root.getBoundingClientRect).toHaveBeenCalledTimes(2);f.touch('touchend',[]);expect(f.commit).toHaveBeenCalledOnce();const click=new Event('click',{cancelable:true});f.root.dispatchEvent(click);expect(click.defaultPrevented).toBe(true);f.dispose();
});
it('leaves normal one-finger scrolling native and batches zoomed scroll writes',()=>{
 const native=fixture();native.touch('touchstart',[[100,200]]);expect(native.touch('touchmove',[[100,150]]).defaultPrevented).toBe(false);expect(native.frames.size).toBe(0);native.dispose();
 const zoomed=fixture(2);zoomed.touch('touchstart',[[100,200]]);expect(zoomed.touch('touchmove',[[100,198]]).defaultPrevented).toBe(false);
 expect(zoomed.touch('touchmove',[[100,180]]).defaultPrevented).toBe(true);zoomed.touch('touchmove',[[100,160]]);expect(zoomed.frames.size).toBe(1);expect(zoomed.scroller.scrollTop).toBe(100);[...zoomed.frames.values()][0](16);expect(zoomed.scroller.scrollTop).toBe(120);zoomed.dispose();
});
