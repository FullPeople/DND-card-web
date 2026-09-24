import {flushSync} from 'react-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type Point = { x: number; y: number };
export type Landing = Point | {element?:HTMLElement;resolve?:()=>HTMLElement|null;region?:HTMLElement;removed?:boolean;morph?:'chip'};
/** A receiving region is an anchor, never the shape of the dragged entry. */
export const landingWithin=(region:HTMLElement,resolve?:()=>HTMLElement|null):Landing=>({region,resolve});
type Gesture = { appearance?:'source'; title: string; subtitle?: string; outside?: (hit: Element | null) => boolean; start?: () => void; move: (point: Point, hit: Element | null) => void; finish: (point: Point, hit: Element | null) => Landing | void; cancel: () => void };
let cancelActive: (() => void) | undefined;
window.addEventListener('sheet-gesture',()=>cancelActive?.());

/** One pointer gesture for catalog entries and sheet chips; never uses HTML drag images. */
export function pointerDrag(event: ReactPointerEvent, gesture: Gesture) {
  if (event.button !== 0 || !event.isPrimary) return;
  cancelActive?.();
  const source = event.currentTarget as HTMLElement;
  const bounds = source.getBoundingClientRect();
  const width = gesture.appearance==='source'?bounds.width:Math.max(48, Math.min(240, bounds.width)), height = gesture.appearance==='source'?bounds.height:Math.max(24, Math.min(80, bounds.height));
  const grab = { x: Math.max(0, Math.min(width, (event.clientX - bounds.x) / Math.max(1, bounds.width) * width)), y: Math.max(0, Math.min(height, (event.clientY - bounds.y) / Math.max(1, bounds.height) * height)) };
  const origin = { x: event.clientX, y: event.clientY };
  let point = origin, painted = origin, active = false, finished = false, frame = 0, ghost: HTMLDivElement | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint() {
    if (!ghost) return;
    painted = point;
    ghost.style.transform = `translate3d(${painted.x - grab.x}px,${painted.y - grab.y}px,0) rotate(${reduced ? 0 : 3}deg)`;
    const hit = document.elementFromPoint(point.x, point.y);
    ghost.classList.toggle('removal-preview', !!gesture.outside?.(hit));
    gesture.move(point, hit);
    let scroller = hit?.closest<HTMLElement>('.cell-content,.box-content,.catalog-list,.stock-drop-zone,.dm-console,.sheet-pane');
    while (scroller) {
      if (scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
        const bounds = scroller.getBoundingClientRect();
        if (point.y < bounds.top + 24) scroller.scrollTop -= 7;
        else if (point.y > bounds.bottom - 24) scroller.scrollTop += 7;
        break;
      }
      scroller = scroller.parentElement?.closest<HTMLElement>('.cell-content,.box-content,.catalog-list,.stock-drop-zone,.dm-console,.sheet-pane') || null;
    }
    frame = requestAnimationFrame(paint);
  }
  function move(e: PointerEvent) {
    if (e.pointerId !== event.pointerId) return;
    point = { x: e.clientX, y: e.clientY };
    if (!active && Math.hypot(point.x - origin.x, point.y - origin.y) >= 5) {
      active = true;
      document.body.classList.add('pointer-dragging');
      ghost = document.createElement('div');ghost.setAttribute('aria-hidden','true');ghost.inert=true; ghost.className = 'drag-ghost pointer-ghost';
      const title = document.createElement('strong'); title.textContent = gesture.title;
      ghost.style.width = `${width}px`; ghost.style.height = `${height}px`;
      ghost.style.transformOrigin = `${grab.x}px ${grab.y}px`;
      ghost.dataset.grabX = String(grab.x); ghost.dataset.grabY = String(grab.y);
      if(gesture.appearance==='source'){
        ghost.className='pointer-ghost stock-drag-source';const copy=source.cloneNode(true) as HTMLElement;
        const originals=[source,...source.querySelectorAll<HTMLElement>('*')],clones=[copy,...copy.querySelectorAll<HTMLElement>('*')];
        originals.forEach((node,i)=>{const clone=clones[i],style=getComputedStyle(node);clone.removeAttribute('id');for(const property of Array.from(style))clone.style.setProperty(property,style.getPropertyValue(property));clone.style.transition='none';clone.style.animation='none';});
        const scale=bounds.width/source.offsetWidth||1;copy.style.width=`${source.offsetWidth}px`;copy.style.height=`${source.offsetHeight}px`;copy.style.minHeight='0';copy.style.margin='0';copy.style.translate='none';copy.style.transform=`scale(${scale})`;copy.style.transformOrigin='0 0';copy.style.visibility='visible';ghost.append(copy);
      }else ghost.append(title); document.body.append(ghost);source.classList.add('drag-lifted');
      window.dispatchEvent(new CustomEvent('card-drag-start',{detail:{source}})); gesture.start?.(); paint();
    }
    if (active) e.preventDefault();
  }
  function finish(cancelled: boolean) {
    if (finished) return; finished = true;
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('keydown', key); window.removeEventListener('blur', cancel);
    cancelAnimationFrame(frame); cancelActive = undefined; document.body.classList.remove('pointer-dragging');
    if (!active) return;
    const suppress = (e: MouseEvent) => { e.preventDefault(); e.stopImmediatePropagation(); };
    document.addEventListener('click', suppress, true);
    setTimeout(() => document.removeEventListener('click', suppress, true), 0);
    let destination:Landing|void;
    const hit=document.elementFromPoint(point.x,point.y);
    try{flushSync(()=>{destination=cancelled?(gesture.cancel(),undefined):gesture.finish(point,hit);});}catch(error){gesture.cancel();ghost?.remove();source.classList.remove('drag-lifted');window.dispatchEvent(new Event('card-drag-end'));throw error;}
    if(ghost){
      const element=ghost;
      const landing=destination!;
      let target=landing&&'resolve' in landing?landing.resolve?.():landing&&'element' in landing?landing.element:!landing?source:undefined;
      let region=landing&&'region' in landing?landing.region:undefined;
      const candidate=target?.getBoundingClientRect();
      // Whole cards, headings and empty groups can receive drops, but must not stretch a
      // tile into their bounding box while an asynchronous recipient updates its contents.
      if(target&&(!target.isConnected||!candidate?.width||!candidate.height||candidate.width>Math.max(width,240)+1||candidate.height>Math.max(height,80)+1)){
        region??=target.isConnected?target:undefined;target=undefined;
      }
      target?.getAnimations().forEach(animation=>animation.cancel());const rect=target?.getBoundingClientRect(),area=region?.getBoundingClientRect();
      const anchor=area&&area.width&&area.height?{x:Math.max(area.left,Math.min(area.right-width,point.x-grab.x)),y:Math.max(area.top,Math.min(area.bottom-height,point.y-grab.y)),width,height}:undefined;
      const end=rect&&rect.width?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:anchor|| (landing&&'removed' in landing&&landing.removed?{x:point.x<innerWidth/2?-width-20:innerWidth+20,y:point.y-grab.y,width,height}:landing&&'x' in landing?{...landing,width,height}:{x:bounds.x,y:bounds.y,width,height});
      const restore=()=>{element.remove();source.classList.remove('drag-lifted');target?.classList.remove('drag-landing-hidden');window.dispatchEvent(new Event('card-drag-end'));};
      if(reduced){restore();return;}
      const hideTarget=!!target;
      if(hideTarget)target?.classList.add('drag-landing-hidden');element.dataset.landing='true';
      const copy=gesture.appearance==='source'?element.firstElementChild as HTMLElement:null;
      if(copy&&target){
        const to=getComputedStyle(target),scale=target.getBoundingClientRect().width/target.offsetWidth||1,morph=landing&&'morph' in landing&&landing.morph==='chip';
        const finishStyle:Record<string,string>={width:`${target.offsetWidth}px`,height:`${target.offsetHeight}px`,transform:`scale(${scale})`};
        if(morph){source.classList.remove('drag-lifted');Object.assign(finishStyle,{background:to.backgroundColor,border:to.border,padding:to.padding,borderRadius:to.borderRadius,clipPath:'none',gridTemplateColumns:'1fr',gridTemplateRows:'1fr',boxShadow:'none'});
          copy.querySelectorAll<HTMLElement>('.stock-quantity,.stock-value,.stock-weight,.stock-frame-art').forEach(node=>node.animate([{opacity:1},{opacity:0}],{duration:130,fill:'forwards'}));
          const name=copy.querySelector<HTMLElement>('.stock-name');if(name){name.style.gridArea='1 / 1 / 2 / -1';name.animate([{fontSize:getComputedStyle(name).fontSize},{fontSize:to.fontSize,lineHeight:to.lineHeight,color:to.color}],{duration:220,fill:'forwards'});}
        }
        copy.animate([{},finishStyle],{duration:220,easing:'cubic-bezier(.2,.8,.25,1)',fill:'forwards'});
      }
      const radius=target?getComputedStyle(target).borderRadius:'6px';
      element.animate([{transform:element.style.transform,width:`${width}px`,height:`${height}px`,borderRadius:getComputedStyle(element).borderRadius},{transform:`translate3d(${end.x}px,${end.y}px,0) rotate(0deg)`,width:`${end.width}px`,height:`${end.height}px`,borderRadius:radius,boxShadow:'0 0 0 transparent'}],{duration:220,easing:'cubic-bezier(.2,.8,.25,1)',fill:'forwards'}).finished.then(restore,restore);
    }else{source.classList.remove('drag-lifted');window.dispatchEvent(new Event('card-drag-end'));}

  }
  function up(e: PointerEvent) { if (e.pointerId === event.pointerId) {point={x:e.clientX,y:e.clientY};finish(false);} }
  function cancel() { finish(true); }
  function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }
  cancelActive = cancel;
  document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
  document.addEventListener('keydown', key); window.addEventListener('blur', cancel);
  return cancel;
}
