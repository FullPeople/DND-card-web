import {useEffect,useLayoutEffect,useRef,type KeyboardEvent,type PointerEvent} from 'react';
import type {Character} from '../core/model';
import {CloudSaveBadge} from '../cloud/CloudSaveBadge';
import {useCharacterBookOrder} from './characterBookOrder';
/** A single-row, roving-tabindex list; navigation never moves the sheet viewport. */
export function CharacterTabs({characters:inputCharacters,activeId,warnings,label,select}:{characters:Character[];activeId:string;warnings:Set<string>;label:string;select:(id:string)=>void}){
 const characters=useCharacterBookOrder(inputCharacters),list=useRef<HTMLDivElement>(null),strip=useRef({width:0,total:0,left:0,positions:new Map<HTMLButtonElement,{left:number;right:number}>()});
 const timing=useRef<{id:string;started:number}|undefined>(undefined);
 const choose=(id:string)=>{if(id!==activeId){if(list.current){delete list.current.dataset.switchCommitMs;delete list.current.dataset.switchPaintMs;}timing.current={id,started:performance.now()};}select(id);};
 const drag=useRef<{id:number;x:number;y:number;left:number;moved:boolean}|undefined>(undefined),suppress=useRef(false);
 const tabIds=JSON.stringify(characters.map(character=>character.id));
 const scrollTo=(left:number)=>{const container=list.current;if(!container)return;const cached=strip.current,next=Math.max(0,Math.min(Math.max(0,cached.total-cached.width),left));if(cached.left===next)return;cached.left=next;container.scrollLeft=next;};
 const reveal=(button:HTMLButtonElement)=>{const cached=strip.current,tab=cached.positions.get(button);if(!tab)return;if(tab.left<cached.left)scrollTo(tab.left);else if(tab.right>cached.left+cached.width)scrollTo(tab.right-cached.width);};
 useLayoutEffect(()=>{const button=list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');if(button)reveal(button);},[activeId,tabIds]);
 useLayoutEffect(()=>{
  const sample=timing.current,container=list.current;if(!sample||sample.id!==activeId||!container)return;
  container.dataset.switchCommitMs=(performance.now()-sample.started).toFixed(2);
  let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{if(timing.current!==sample)return;container.dataset.switchPaintMs=(performance.now()-sample.started).toFixed(2);timing.current=undefined;});});
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[activeId]);
 useLayoutEffect(()=>{
  const container=list.current;if(!container)return;
  // ResizeObserver runs after layout. Read all tab geometry here once, rather
  // than forcing a whole-sheet layout from each selection's layout effect.
  const observer=new ResizeObserver(()=>{
   const box=container.getBoundingClientRect(),left=container.scrollLeft,positions=new Map<HTMLButtonElement,{left:number;right:number}>();
   for(const button of container.querySelectorAll<HTMLButtonElement>('[role="tab"]')){const tab=button.getBoundingClientRect();positions.set(button,{left:tab.left-box.left+left,right:tab.right-box.left+left});}
   strip.current={width:container.clientWidth,total:container.scrollWidth,left,positions};
   const button=container.querySelector<HTMLButtonElement>('[aria-selected="true"]');if(button)reveal(button);
  });
  observer.observe(container);for(const button of container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))observer.observe(button);
  const scrolled=()=>{strip.current.left=container.scrollLeft;};container.addEventListener('scroll',scrolled,{passive:true});
  return()=>{observer.disconnect();container.removeEventListener('scroll',scrolled);};
 },[tabIds]);
 useEffect(()=>{const container=list.current;if(!container)return;const wheel=(event:WheelEvent)=>{const cached=strip.current;if(event.ctrlKey||cached.total<=cached.width)return;const distance=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?24:event.deltaMode===2?cached.width:1);event.preventDefault();scrollTo(cached.left+distance);};container.addEventListener('wheel',wheel,{passive:false});return()=>container.removeEventListener('wheel',wheel);},[]);
 const start=(event:PointerEvent<HTMLDivElement>)=>{if(!event.isPrimary||event.button!==0)return;suppress.current=false;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:strip.current.left,moved:false};};
 const move=(event:PointerEvent<HTMLDivElement>)=>{const origin=drag.current;if(!origin||event.pointerId!==origin.id)return;const distance=event.clientX-origin.x;if(Math.hypot(distance,event.clientY-origin.y)>5){origin.moved=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.classList.add('is-dragging');}if(origin.moved){event.preventDefault();scrollTo(origin.left-distance);}};
 const finish=(event:PointerEvent<HTMLDivElement>)=>{const origin=drag.current;if(!origin||event.pointerId!==origin.id)return;suppress.current=origin.moved;drag.current=undefined;event.currentTarget.classList.remove('is-dragging');if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
 const navigate=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%characters.length;else if(event.key==='ArrowLeft')next=(index-1+characters.length)%characters.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=characters.length-1;else return;event.preventDefault();const button=list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];button?.focus({preventScroll:true});if(button)reveal(button);choose(characters[next].id);};
 return <div ref={list} className="character-tabs" role="tablist" aria-orientation="horizontal" aria-label={label} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onClickCapture={event=>{if(suppress.current){event.preventDefault();event.stopPropagation();suppress.current=false;}}}>{characters.map((character,index)=><button key={character.id} type="button" role="tab" tabIndex={character.id===activeId?0:-1} aria-selected={character.id===activeId} title={character.name} onKeyDown={event=>navigate(event,index)} onClick={()=>choose(character.id)}>{character.name}<CloudSaveBadge id={character.id}/>{warnings.has(character.id)&&<span className="class-warning-icon" aria-label="旧卡资料需要核对">⚠</span>}</button>)}</div>;
}
