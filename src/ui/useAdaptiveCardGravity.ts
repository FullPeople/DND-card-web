import {useLayoutEffect,useState,type RefObject} from 'react';

/** Local-pixel gravity for resizable surfaces. Text and hit areas keep their real
 * size; dense layouts reduce tilt instead of stretching or escaping the card. */
export function useAdaptiveCardGravity(ref:RefObject<HTMLElement|null>,enabled:boolean,identity:string,layoutKey='',editing=false,{expand=false,inset=2}:{expand?:boolean;inset?:number}={}){
 const [structure,setStructure]=useState(0);
 const cellsOf=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>('[data-adaptive-physical]')].filter(node=>{const parent=node.parentElement?.closest('[data-adaptive-physical]');return !parent||!root.contains(parent);});
 useLayoutEffect(()=>{const root=ref.current;if(!root)return;let cells:HTMLElement[]=[],signature='';const measure=()=>{const next=cellsOf(root),stamp=[root.clientWidth,expand?'':root.clientHeight,...next.flatMap(n=>[n.offsetWidth,n.offsetHeight,n.offsetLeft,n.offsetTop])].join(':');if(next.length!==cells.length||next.some((n,i)=>n!==cells[i])){resize.disconnect();resize.observe(root);for(const node of next)resize.observe(node);cells=next;signature='';}if(stamp!==signature){signature=stamp;setStructure(n=>n+1);}};const resize=new ResizeObserver(measure),mutation=new MutationObserver(measure);measure();mutation.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-adaptive-physical']});return()=>{resize.disconnect();mutation.disconnect();};},[ref,expand]);
 useLayoutEffect(()=>{const root=ref.current;if(!root)return;const cells=cellsOf(root);let frame=0,restoreTimer:ReturnType<typeof setTimeout>|undefined;
  for(const node of cells){node.style.transition='translate 650ms cubic-bezier(.2,.7,.2,1), transform 700ms cubic-bezier(.2,.7,.2,1), filter .7s';node.style.translate='0px 0px';node.style.setProperty('--adaptive-fall-tilt','0deg');delete node.dataset.adaptiveFallen;}
  if(!enabled||editing){restoreTimer=setTimeout(()=>root.style.removeProperty('--adaptive-gravity-height'),700);return()=>clearTimeout(restoreTimer);}
  // No transition participates in measuring original flow coordinates.
  for(const node of cells){node.style.transition='filter .7s';node.style.translate='none';}
  const origin=root.getBoundingClientRect(),scale=origin.width/Math.max(1,root.offsetWidth),width=root.clientWidth,height=root.clientHeight;
  if(!width||!height||!scale)return;
  const limits=(node:HTMLElement)=>{const bounds={left:0,top:0,right:width,bottom:expand?Infinity:height};for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement){const css=getComputedStyle(parent),clip=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(css.overflowY)){bounds.top=Math.max(bounds.top,(clip.top-origin.top)/scale+parent.clientTop);bounds.bottom=Math.min(bounds.bottom,(clip.top-origin.top)/scale+parent.clientTop+parent.clientHeight);}if(/auto|scroll|hidden|clip/.test(css.overflowX)){bounds.left=Math.max(bounds.left,(clip.left-origin.left)/scale+parent.clientLeft);bounds.right=Math.min(bounds.right,(clip.left-origin.left)/scale+parent.clientLeft+parent.clientWidth);}}return bounds;};
  const bodies=cells.flatMap((node,index)=>{const r=node.getBoundingClientRect(),w=node.offsetWidth,h=node.offsetHeight,left=(r.left-origin.left)/scale,top=(r.top-origin.top)/scale;
   const bounds=limits(node);if(!w||!h||top<bounds.top-.5||top+h>bounds.bottom+.5||left<bounds.left-.5||left+w>bounds.right+.5)return [];
   const free=Math.max(0,width-w),desired=index%3===1&&w<width*.84&&h<170&&free>14?(index%2?-1:1)*3:0;
   return [{node,left,top,width:w,height:h,desired,bounds,angle:0,x:left,y:top,w,h,depth:0,dx:0,dy:0,targetX:0,targetY:0,velocity:0}];
  }).sort((a,b)=>b.top+b.height-a.top-a.height);
  if(!bodies.length)return;
  const naturalBottom=Math.max(...bodies.map(b=>b.top+b.height)),extra=expand?Math.min(40,Math.max(18,naturalBottom*.15)):0,maxFloor=expand?naturalBottom+extra:height-inset;
  const overlaps=(a:typeof bodies[number],b:typeof bodies[number])=>a.x<b.x+b.w-.2&&a.x+a.w>b.x+.2;
  let floor=maxFloor,fits=false;
  for(let attempt=0;attempt<14;attempt++){const tilt=attempt===13?0:Math.pow(.66,attempt);fits=true;
   for(let i=0;i<bodies.length;i++){const b=bodies[i];b.angle=b.desired*tilt;const rad=Math.abs(b.angle)*Math.PI/180;b.w=Math.max(b.width,b.width*Math.cos(rad)+b.height*Math.sin(rad));b.h=Math.max(b.height,b.height*Math.cos(rad)+b.width*Math.sin(rad));b.x=Math.min(Math.max(b.bounds.left,b.left-(b.w-b.width)/2),Math.max(b.bounds.left,b.bounds.right-b.w));b.y=b.top-(b.h-b.height)/2;
    let bottom=Math.min(maxFloor,b.bounds.bottom-inset);for(let j=0;j<i;j++)if(overlaps(b,bodies[j]))bottom=Math.min(bottom,maxFloor-bodies[j].depth-2);b.depth=maxFloor-(bottom-b.h);
    if(bottom-b.h<b.y-.2||bottom-b.h<b.bounds.top||b.w>b.bounds.right-b.bounds.left)fits=false;
   }
   if(fits){floor=maxFloor;break;}
  }
  // A fully occupied/overlapping scroll viewport has no safe packing volume.
  // Preserve its actual layout; never shrink a box or force it beyond the bounds.
  if(!fits){for(const b of bodies){b.angle=0;b.targetX=0;b.targetY=0;}floor=height-inset;}
  else for(const b of bodies){b.targetX=b.x-(b.left-(b.w-b.width)/2);b.targetY=Math.max(0,floor-b.depth-b.y);}
  if(expand&&fits)root.style.setProperty('--adaptive-gravity-height',`${Math.ceil(floor+inset)}px`);
  for(const b of bodies)b.node.dataset.adaptiveFallen='true';
  const paint=(b:typeof bodies[number],progress:number)=>{b.node.style.translate=`${(b.targetX*progress).toFixed(3)}px ${b.dy.toFixed(3)}px`;b.node.style.setProperty('--adaptive-fall-tilt',`${(b.angle*progress).toFixed(3)}deg`);};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!fits){for(const b of bodies){b.dy=b.targetY;paint(b,1);}return;}
  let previous=performance.now(),elapsed=0;
  const tick=(now:number)=>{const dt=Math.min(.032,(now-previous)/1000);previous=now;elapsed+=dt;const lean=1-Math.pow(1-Math.min(1,elapsed/.85),3);let moving=elapsed<.9;
   for(let i=0;i<bodies.length;i++){const b=bodies[i];b.velocity+=850*dt;b.dy+=b.velocity*dt;let limit=b.targetY;for(let j=0;j<i;j++)if(overlaps(b,bodies[j]))limit=Math.min(limit,bodies[j].y+bodies[j].dy-b.y-b.h-2);limit=Math.max(0,limit);if(b.dy>=limit){b.dy=limit;b.velocity=b.velocity>35?-b.velocity*.14:0;}paint(b,lean);if(Math.abs(b.dy-b.targetY)>.2||Math.abs(b.velocity)>1)moving=true;}
   if(moving&&elapsed<2.6)frame=requestAnimationFrame(tick);else for(const b of bodies){b.dy=b.targetY;paint(b,1);}
  };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[ref,enabled,editing,identity,layoutKey,structure,expand,inset]);
}
