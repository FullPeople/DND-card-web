import { useLayoutEffect, type RefObject } from 'react';

/** Conservative rotated bounds keep real DOM hit areas inside the pile. */
export function useCardGravity(ref: RefObject<HTMLDivElement | null>, enabled: boolean, page: string, identity: string) {
  useLayoutEffect(() => {
    const paper = ref.current; if (!paper) return;
    const cells = [...paper.querySelectorAll<HTMLElement>('.sheet-cell')];
    let frame = 0;
    if (!enabled) {
      for (const cell of cells) {
        cell.style.transition = 'translate 700ms cubic-bezier(.2,.7,.2,1), transform 700ms cubic-bezier(.2,.7,.2,1), rotate 900ms cubic-bezier(.3,.8,.3,1)';
        cell.style.translate = '0px 0px'; cell.style.setProperty('--fall-tilt', '0deg'); delete cell.dataset.fallen;
      }
      return;
    }
    const scale = paper.getBoundingClientRect().width / paper.offsetWidth;
    for (const cell of cells) {
      cell.style.transition = 'rotate 900ms cubic-bezier(.3,.8,.3,1)';
      cell.style.translate = 'none'; cell.style.setProperty('--fall-tilt', '0deg');
    }
    const origin = paper.getBoundingClientRect();
    const bodies = cells.map((element, index) => {
      const r = element.getBoundingClientRect(), width = element.offsetWidth, height = element.offsetHeight;
      const left = (r.x+r.width/2-origin.x)/scale-width/2, top = (r.y+r.height/2-origin.y)/scale-height/2;
      const desired = index % 3 === 1 && width < 210 && height < 210 ? (index % 2 ? -1 : 1) * (3 + index % 3) : 0;
      return { element, left, top, width, height, desired, angle:0, x:left, y:top, w:width, h:height, dy:0, velocity:0, target:0 };
    }).sort((a,b)=>(b.top+b.height)-(a.top+a.height));
    const floor = paper.clientHeight - 12;
    const overlaps = (a:typeof bodies[number],b:typeof bodies[number]) => a.x < b.x+b.w && a.x+a.w > b.x;
    // Reserve enough room for the entire rotation, including the neighbouring column.
    // Dense layouts automatically reduce the angle instead of overlapping or pushing a box upward.
    let amount = 1;
    for (let attempt=0; attempt<18; attempt++) {
      for (const b of bodies) {
        b.angle = b.desired * amount;
        const radians = Math.abs(b.angle)*Math.PI/180;
        b.w = Math.max(b.width, b.width*Math.cos(radians)+b.height*Math.sin(radians));
        b.h = Math.max(b.height, b.height*Math.cos(radians)+b.width*Math.sin(radians));
        b.x = b.left-(b.w-b.width)/2; b.y = b.top-(b.h-b.height)/2;
      }
      let fits = true;
      for (let i=0;i<bodies.length;i++) {
        const b=bodies[i]; let bottom=floor;
        for(let j=0;j<i;j++)if(overlaps(b,bodies[j]))bottom=Math.min(bottom,bodies[j].y+bodies[j].target-2);
        b.target=bottom-b.y-b.h;
        if(b.target<0 || b.x<3 || b.x+b.w>paper.clientWidth-3)fits=false;
      }
      if(fits)break;
      amount = attempt === 16 ? 0 : amount*.75;
    }
    for(const b of bodies)b.element.dataset.fallen='true';
    function paint(b:typeof bodies[number], angle:number){b.element.style.translate=`0px ${b.dy.toFixed(3)}px`;b.element.style.setProperty('--fall-tilt',`${angle.toFixed(3)}deg`);}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){for(const b of bodies){b.dy=b.target;paint(b,b.angle);}return;}
    let previous=performance.now(),elapsed=0;
    function tick(now:number){
      const dt=Math.min((now-previous)/1000,.032);previous=now;elapsed+=dt;let moving=elapsed<1;
      const lean=1-Math.pow(1-Math.min(1,elapsed/.9),3);
      for(let i=0;i<bodies.length;i++){
        const b=bodies[i];b.velocity+=1050*dt;b.dy+=b.velocity*dt;
        let limit=b.target;
        for(let j=0;j<i;j++)if(overlaps(b,bodies[j]))limit=Math.min(limit,bodies[j].y+bodies[j].dy-b.y-b.h-2);
        limit=Math.max(0,limit);
        if(b.dy>=limit){b.dy=limit;b.velocity=b.velocity>35?-b.velocity*.16:0;}
        paint(b,b.angle*lean);
        if(Math.abs(b.dy-b.target)>.15||Math.abs(b.velocity)>1)moving=true;
      }
      if(moving&&elapsed<3)frame=requestAnimationFrame(tick);else for(const b of bodies){b.dy=b.target;paint(b,b.angle);}
    }
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[ref,enabled,page,identity]);
}
