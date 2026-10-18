export type SheetView={zoom:number;x:number;y:number};
type Point={distance:number;x:number;y:number};
type Pinch=Point&{view:SheetView;cx:number;cy:number};
export function pinchView(start:Pinch,point:Point,width:number,height:number):SheetView{
 const zoom=Math.max(1,Math.min(3.5,start.view.zoom*point.distance/Math.max(1,start.distance))),ratio=zoom/start.view.zoom;
 const bound=(value:number,size:number)=>Math.max(-size*(zoom-1)/2,Math.min(size*(zoom-1)/2,value));
 return {zoom,x:bound(point.x-start.cx-(start.x-start.cx-start.view.x)*ratio,width),y:bound(point.y-start.cy-(start.y-start.cy-start.view.y)*ratio,height)};
}
/** Latest value per frame; cancellation also discards stale work when a card changes. */
export function frameLatest<T>(paint:(value:T)=>void,request:(callback:FrameRequestCallback)=>number=callback=>requestAnimationFrame(callback),cancel:(id:number)=>void=id=>cancelAnimationFrame(id)){
 let frame:number|undefined,latest:T;
 return {push(value:T){latest=value;if(frame===undefined)frame=request(()=>{frame=undefined;paint(latest);});},
  cancel(){if(frame!==undefined)cancel(frame);frame=undefined;}};
}
export function sheetTouch(root:HTMLElement,read:()=>SheetView,update:(view:SheetView)=>void,commit:()=>void){
 let start:Pinch|undefined,bounds={width:0,height:0},scroller:HTMLElement|null=null,lastY=0,startY=0,lastTime=0,velocity=0,scrolling=false,suppressUntil=0,inertia:number|undefined;
 const pair=(touches:TouchList):Point=>({distance:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY),x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});
 const scroll=frameLatest<number>(position=>{if(scroller)scroller.scrollTop=position;});
 let desiredScroll=0;
 const stopInertia=()=>{if(inertia!==undefined)cancelAnimationFrame(inertia);inertia=undefined;scroll.cancel();};
 const gesture=()=>window.dispatchEvent(new Event('sheet-gesture'));
 const begin=(event:TouchEvent)=>{
  stopInertia();velocity=0;scrolling=false;
  if(event.touches.length===2){
   event.preventDefault();gesture();scroller=null;const view=read(),rect=(root.querySelector('.paper-stack')||root).getBoundingClientRect();bounds=root.getBoundingClientRect();
   start={...pair(event.touches),view,cx:rect.x+rect.width/2-view.x,cy:rect.y+rect.height/2-view.y};suppressUntil=Date.now()+600;
  }else if(event.touches.length===1&&!start){
   lastY=startY=event.touches[0].clientY;lastTime=performance.now();
   scroller=(event.target as Element).closest<HTMLElement>('.cell-content,.box-content,.feature-page-body,.detail-page-body');
   while(scroller&&scroller.scrollHeight<=scroller.clientHeight)scroller=scroller.parentElement?.closest<HTMLElement>('.cell-content,.box-content')||null;
   desiredScroll=scroller?.scrollTop||0;
  }
 };
 const move=(event:TouchEvent)=>{
  if(start&&event.touches.length>=2){
   event.preventDefault();event.stopPropagation();update(pinchView(start,pair(event.touches),bounds.width,bounds.height));suppressUntil=Date.now()+600;
  }else if(!start&&event.touches.length===1&&scroller&&!root.querySelector('.visual-editing')){
   const y=event.touches[0].clientY,now=performance.now();if(!scrolling&&Math.abs(startY-y)<6)return;
   if(!scrolling){scrolling=true;gesture();}
   // At normal zoom the browser owns scrolling and its native inertia.
   if(read().zoom>1.01){event.preventDefault();const delta=(lastY-y)/read().zoom;velocity=delta/Math.max(8,now-lastTime);desiredScroll=Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,desiredScroll+delta));scroll.push(desiredScroll);}
   lastY=y;lastTime=now;suppressUntil=Date.now()+400;
  }
 };
 const end=(event:TouchEvent)=>{
  if(start){suppressUntil=Date.now()+400;start=undefined;commit();scroller=null;return;}
  if(event.type==='touchcancel'){stopInertia();scroller=null;return;}
  if(!scrolling||!scroller||read().zoom<=1.01||performance.now()-lastTime>80)return;
  const target=scroller;let previous=performance.now(),elapsed=0;
  const coast=(time:number)=>{const dt=Math.min(32,time-previous);previous=time;elapsed+=dt;velocity*=Math.exp(-dt/90);
   const next=Math.max(0,Math.min(target.scrollHeight-target.clientHeight,desiredScroll+velocity*dt));target.scrollTop=next;
   if(Math.abs(velocity)>.015&&elapsed<400&&next!==desiredScroll){desiredScroll=next;inertia=requestAnimationFrame(coast);}else inertia=undefined;
  };
  scroll.cancel();target.scrollTop=desiredScroll;inertia=requestAnimationFrame(coast);scrolling=false;
 };
 const click=(event:MouseEvent)=>{if(Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}};
 root.addEventListener('touchstart',begin,{passive:false,capture:true});root.addEventListener('touchmove',move,{passive:false,capture:true});root.addEventListener('touchend',end);root.addEventListener('touchcancel',end);root.addEventListener('click',click,true);
 return()=>{stopInertia();root.removeEventListener('touchstart',begin,true);root.removeEventListener('touchmove',move,true);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',end);root.removeEventListener('click',click,true);};
}
