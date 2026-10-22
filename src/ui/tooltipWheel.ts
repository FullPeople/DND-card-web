type WheelPixels={x:number;y:number};
type WheelInput=Pick<WheelEvent,'deltaX'|'deltaY'|'deltaMode'|'shiftKey'>;
const epsilon=.01;
const scrollable=(overflow:string)=>/^(auto|scroll|overlay)$/.test(overflow);
const modalSelector='[aria-modal="true"],dialog:modal';

export function wheelPixels(event:WheelInput,page:{width:number;height:number}):WheelPixels{
  const x=event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX;
  const y=event.shiftKey&&!event.deltaX?0:event.deltaY;
  return {x:x*(event.deltaMode===1?16:event.deltaMode===2?page.width:1),y:y*(event.deltaMode===1?16:event.deltaMode===2?page.height:1)};
}
export function scrollPosition(position:number,extent:number,delta:number,rtl=false){
  return Math.max(rtl?-Math.max(0,extent):0,Math.min(rtl?0:Math.max(0,extent),position+delta));
}
function remaining(delta:number,moved:number){const value=delta-moved;return Math.abs(value)<epsilon?0:value;}

function scrollChain(start:HTMLElement,limit:HTMLElement|undefined,pixels:WheelPixels,respectContainment:boolean){
  let moved=false,blocked=false;
  for(let node:HTMLElement|null=start;node;node=node.parentElement){
    const style=getComputedStyle(node),root=node===document.scrollingElement;
    const rootLocked=root&&[node,document.body].some(el=>/^(hidden|clip)$/.test(getComputedStyle(el).overflowY));
    const canX=scrollable(style.overflowX)||(root&&!rootLocked&&!/^(hidden|clip)$/.test(style.overflowX));
    const canY=scrollable(style.overflowY)||(root&&!rootLocked&&!/^(hidden|clip)$/.test(style.overflowY));
    const oldX=node.scrollLeft,oldY=node.scrollTop;
    const left=canX?scrollPosition(oldX,node.scrollWidth-node.clientWidth,pixels.x,style.direction==='rtl'):oldX;
    const top=canY?scrollPosition(oldY,node.scrollHeight-node.clientHeight,pixels.y):oldY;
    if(Math.abs(left-oldX)>epsilon||Math.abs(top-oldY)>epsilon){
      node.scrollTo({left,top,behavior:'instant'});
      const dx=node.scrollLeft-oldX,dy=node.scrollTop-oldY;
      pixels={x:remaining(pixels.x,dx),y:remaining(pixels.y,dy)};
      moved ||= Math.abs(dx)>epsilon||Math.abs(dy)>epsilon;
    }
    // A modal's own scroll boundary still owns its overscroll policy. Tooltip
    // boundaries, in contrast, hand the remaining motion to the layer below.
    if(respectContainment){
      if(pixels.x&&canX&&/^(contain|none)$/.test(style.overscrollBehaviorX)){pixels.x=0;blocked=true;}
      if(pixels.y&&canY&&/^(contain|none)$/.test(style.overscrollBehaviorY)){pixels.y=0;blocked=true;}
    }
    if(respectContainment&&node.matches(modalSelector)){
      blocked ||= !!(pixels.x||pixels.y);
      break;
    }
    if(node===limit||!pixels.x&&!pixels.y)break;
  }
  return {pixels,moved,blocked};
}

/** Scroll the hit tooltip first, then the actual visible layer under its portal. */
export function scrollTooltipWheel(event:WheelEvent,pane:HTMLElement|null){
  if(event.ctrlKey||event.defaultPrevented||!event.cancelable)return {handled:false,forwarded:false};
  const target=event.target instanceof HTMLElement?event.target:event.target instanceof Element?event.target.parentElement:undefined;
  const content=pane?.querySelector<HTMLElement>('.keyword-content');
  let pixels=wheelPixels(event,{width:content?.clientWidth||innerWidth,height:content?.clientHeight||innerHeight});
  let handled=false,forwarded=false;
  if(!pixels.x&&!pixels.y)return {handled,forwarded};
  if(pane&&content){
    const first=target&&content.contains(target)?target:content;
    const result=scrollChain(first,pane,pixels,false);
    pixels=result.pixels;handled=result.moved;
  }
  if(!pixels.x&&!pixels.y)return {handled,forwarded};
  // Over the original reference there is no portal in the event path: native
  // scrolling already reaches the correct reading pane without redispatching.
  if(!target?.closest('[data-tooltip-id],.tooltip-backdrop')){
    if(handled&&target){
      const result=scrollChain(target,undefined,pixels,true);
      handled ||= result.moved||result.blocked;forwarded=result.moved;
    }
    return {handled,forwarded};
  }
  const skipped=new Set<HTMLElement>();if(pane)skipped.add(pane);
  const layers=document.elementsFromPoint(event.clientX,event.clientY);
  for(const layer of layers){
    if(!(layer instanceof HTMLElement)||layer.closest('.tooltip-backdrop'))continue;
    const tooltip=layer.closest<HTMLElement>('[data-tooltip-id]');
    if(tooltip&&skipped.has(tooltip))continue;
    if(tooltip){
      skipped.add(tooltip);
      const body=tooltip.querySelector<HTMLElement>('.keyword-content');
      if(!body)continue;
      const result=scrollChain(body.contains(layer)?layer:body,tooltip,pixels,false);
      pixels=result.pixels;handled ||= result.moved;forwarded ||= result.moved;
    }else{
      // A modal backdrop is also a boundary, even when it does not use body
      // scroll locking. Never route through it to the document behind it.
      if(!layer.closest(modalSelector)&&[...document.querySelectorAll<HTMLElement>(modalSelector)].some(modal=>modal.getClientRects().length&&!modal.inert))return {handled:true,forwarded};
      const result=scrollChain(layer,undefined,pixels,true);
      handled ||= result.moved||result.blocked;forwarded ||= result.moved;
      break;
    }
    if(!pixels.x&&!pixels.y)break;
  }
  return {handled,forwarded};
}
