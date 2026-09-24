/** A clicked spell travels as its actual tile; no fade or second card skin. */
export function liftSpellTile(source:HTMLElement){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return (_?:HTMLElement|null)=>{};
 const bounds=source.getBoundingClientRect(),copy=source.cloneNode(true) as HTMLElement;
 const originals=[source,...source.querySelectorAll<HTMLElement>('*')],clones=[copy,...copy.querySelectorAll<HTMLElement>('*')];
 originals.forEach((node,i)=>{const clone=clones[i],style=getComputedStyle(node);clone.removeAttribute('id');for(const property of Array.from(style))clone.style.setProperty(property,style.getPropertyValue(property));clone.style.transition='none';clone.style.animation='none';});
 const layer=document.createElement('div');layer.className='spell-tile-flight';layer.setAttribute('aria-hidden','true');layer.inert=true;
 Object.assign(layer.style,{position:'fixed',left:'0',top:'0',width:`${bounds.width}px`,height:`${bounds.height}px`,pointerEvents:'none',zIndex:'2147482500',transform:`translate(${bounds.x}px,${bounds.y}px)`,transformOrigin:'0 0'});
 Object.assign(copy.style,{margin:'0',width:`${source.offsetWidth}px`,height:`${source.offsetHeight}px`,minHeight:'0',translate:'none',transform:`scale(${bounds.width/source.offsetWidth})`,transformOrigin:'0 0'});
 layer.append(copy);document.body.append(layer);
 return (target?:HTMLElement|null)=>{
  if(!target){layer.remove();return;}
  const end=target.getBoundingClientRect();if(!end.width){layer.remove();return;}
  target.classList.add('spell-flight-arrival');
  const finish=()=>{layer.remove();target.classList.remove('spell-flight-arrival');};
  layer.animate([{transform:layer.style.transform},{transform:`translate(${end.x}px,${end.y}px) scale(${end.width/bounds.width},${end.height/bounds.height})`}],{duration:260,easing:'cubic-bezier(.22,.7,.22,1)',fill:'forwards'}).finished.then(finish,finish);
 };
}
