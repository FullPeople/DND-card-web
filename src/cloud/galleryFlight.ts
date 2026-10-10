import {galleryMotion} from './galleryMotion';

type Snapshot={offset:number;transform:string;opacity:string};
export type GalleryFlight={delta:number;snapshots:Map<string,Snapshot>};
const timing={duration:320,easing:'cubic-bezier(.22,.8,.22,1)'};

/** Preserve the paper that leaves an edge while its new occurrence enters. */
export function prepareGalleryFlight(stage:HTMLElement,next:Map<string,number>,delta:number,departures:HTMLElement,animations:Set<Animation>):GalleryFlight{
 const snapshots=new Map<string,Snapshot>();
 for(const node of stage.querySelectorAll<HTMLElement>('.cloud-gallery-item')){
  const style=getComputedStyle(node);snapshots.set(node.dataset.cardId!,{offset:Number(node.dataset.offset),transform:style.transform,opacity:style.opacity});
 }
 for(const animation of animations)animation.cancel();animations.clear();departures.replaceChildren();
 const spacing=parseFloat(stage.style.getPropertyValue('--gallery-spacing')||'180');
 for(const node of stage.querySelectorAll<HTMLElement>('.cloud-gallery-item')){
  const before=snapshots.get(node.dataset.cardId!)!,after=next.get(node.dataset.cardId!);
  if(after!==undefined&&before.offset===after+delta)continue;
  const clone=node.cloneNode(true) as HTMLElement;
  clone.className='cloud-gallery-departure';clone.inert=true;clone.setAttribute('aria-hidden','true');clone.removeAttribute('data-card-id');
  Object.assign(clone.style,{transform:before.transform,opacity:before.opacity});departures.append(clone);
  const animation=clone.animate([{transform:before.transform,opacity:before.opacity},{transform:galleryMotion(before.offset-delta,spacing).transform,opacity:0}],timing);
  animations.add(animation);void animation.finished.catch(()=>{}).then(()=>{animations.delete(animation);clone.remove();});
 }
 return {delta,snapshots};
}

export function flyGalleryPaper(node:HTMLElement,offset:number,spacing:number,flight:GalleryFlight,animations:Set<Animation>){
 const before=flight.snapshots.get(node.dataset.cardId!),continuous=before?.offset===offset+flight.delta,target=galleryMotion(offset,spacing);
 const from=continuous?{transform:before.transform,opacity:before.opacity}:{transform:galleryMotion(offset+flight.delta,spacing).transform,opacity:0};
 Object.assign(node.style,target);
 const animation=node.animate([from,{transform:target.transform,opacity:1}],timing);
 animations.add(animation);void animation.finished.catch(()=>{}).then(()=>animations.delete(animation));
}
