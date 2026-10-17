export const SPACE_STYLES = [
  {id: 'orbits', name: '星轨'},
  {id: 'night', name: '深空'},
  {id: 'waves', name: '引力波'},
  {id: 'nebula', name: '星云'},
] as const;
export type SpaceStyle = typeof SPACE_STYLES[number]['id'];

/** A flat, time-driven universe. Its state never reads pointer coordinates. */
export function mountSpace(container: HTMLElement) {
  const canvas = document.createElement('canvas');
  container.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw Error('无法创建二维背景');
  const ctx = context;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 1, height = 1, frame = 0, last = 0, elapsed = 0, style: SpaceStyle = 'orbits';
  const stars = Array.from({length: 160}, (_, i) => ({
    x: ((i * 167 + 53) % 997) / 997,
    y: ((i * 313 + 79) % 991) / 991,
    phase: i * 1.618, size: i % 9 === 0 ? 1.6 : .65,
  }));
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); render();
  }
  function line(color: string, alpha = 1, size = 1) { ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = size; }
  function dot(x: number, y: number, r: number, color: string, alpha = 1) { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  function star(x: number, y: number, r: number, color: string, alpha = 1) { line(color,alpha,.9); ctx.beginPath(); ctx.moveTo(x-r,y); ctx.lineTo(x+r,y); ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke(); }
  function ellipse(x: number, y: number, rx: number, ry: number, tilt: number, color: string, alpha: number, dashed = false) {
    line(color,alpha,.8); ctx.setLineDash(dashed ? [2,8] : []);
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,tilt,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  function orbitPoint(rx: number, ry: number, tilt: number, phase: number) {
    const x=rx*Math.cos(phase), y=ry*Math.sin(phase);
    return [width*.5+x*Math.cos(tilt)-y*Math.sin(tilt), height*.46+x*Math.sin(tilt)+y*Math.cos(tilt)];
  }
  function drawOrbits(t: number, dark: boolean) {
    const s=Math.min(width,height), color=dark?'#aabbcf':'#9c9f8d';
    for(let i=0;i<5;i++) {
      const rx=s*(.38+i*.12),ry=s*(.16+i*.071),tilt=-.34+i*.018;
      ellipse(width*.5,height*.46,rx,ry,tilt,color,dark?.20:.28,i===1||i===4);
      const [x,y]=orbitPoint(rx,ry,tilt,t*(.019-i*.002)+i*2.32);
      dot(x,y,i===3?9:3.8,dark?['#dbc089','#97acb8','#bcceba'][i%3]:['#bd704b','#708d83','#c8b46e'][i%3]);
      if(i===3)ellipse(x,y,17,17,0,color,.4);
    }
    if(!dark) {
      for(const p of stars.filter((_,i)=>i%9===0)) {
        const alpha=.22+.12*Math.sin(t*.2+p.phase);
        if(p.size>1)star(p.x*width,p.y*height,4,color,alpha);else dot(p.x*width,p.y*height,1,color,alpha);
      }
      for(let i=0;i<3;i++) {
        const x=[.83,.12,.87][i]*width,y=[.21,.75,.77][i]*height;
        ellipse(x,y,s*(.055+i*.008),s*(.055+i*.008),0,color,.24);
        const a=t*.055+i*1.8,r=s*(.055+i*.008);dot(x+Math.cos(a)*r,y+Math.sin(a)*r,2.5,'#b4b195',.8);
      }
    } else {
      for(const p of stars) {
        const alpha=.2+.45*(.5+.5*Math.sin(t*.15+p.phase));
        if(p.size>1)star(p.x*width,p.y*height,2.5,'#d2d6cc',alpha);else dot(p.x*width,p.y*height,p.size,'#d2d6cc',alpha);
      }
      for(let i=0;i<11;i++) { line('#d7bc84',.025+i*.004,.8);ctx.beginPath();ctx.arc(width*.86,height*.1,s*(.10+i*.055),.2,2.7);ctx.stroke(); }
    }
  }
  function drawWaves(t: number) {
    const s=Math.min(width,height),centers=[[width*.08,height*.17],[width*.92,height*.73]];
    for(let c=0;c<centers.length;c++)for(let i=0;i<20;i++) {
      const phase=(i/20+t*.008)%1,r=s*(.10+phase*.85),[x,y]=centers[c];
      line(c?'#83a292':'#608a74',Math.sin(phase*Math.PI)*.19,.8);
      ctx.beginPath();ctx.ellipse(x,y,r,r*.72,c?.6:-.4,0,Math.PI*2);ctx.stroke();
    }
    for(let i=0;i<5;i++) {
      const rx=s*(.3+i*.105),ry=s*(.16+i*.04),tilt=-.3;
      ellipse(width*.5,height*.46,rx,ry,tilt,'#769689',.13);
      const [x,y]=orbitPoint(rx,ry,tilt,t*.018+i*2.7);dot(x,y,i%2?3:5,['#6f9f84','#b5bca0','#d6b17f'][i%3],.7);
    }
    for(const p of stars.filter((_,i)=>i%4===0))dot(p.x*width,p.y*height,.7,'#598373',.22);
  }
  function drawNebula(t: number) {
    const s=Math.min(width,height);
    for(let band=0;band<3;band++) {
      const y=height*[.18,.74,.43][band],color=['#c8b8d5','#dfbcb6','#b4c6d4'][band];
      for(let j=0;j<15;j++) {
        line(color,.24,.8);ctx.beginPath();
        for(let step=0;step<=100;step++) {
          const x=width*step/100,wave=y+Math.sin(x/width*Math.PI*1.8+t*.018+band*1.6)*s*.12+Math.sin(x/width*Math.PI*3+t*.013)*s*.025,py=wave+(j-7)*6;
          if(!step)ctx.moveTo(x,py);else ctx.lineTo(x,py);
        }ctx.stroke();
      }
    }
    for(let i=0;i<45;i++) {
      const p=stars[i],a=t*.022+p.phase,x=p.x*width+Math.sin(a)*12,y=p.y*height+Math.cos(a)*9;
      if(i%9===0)star(x,y,4,'#987bac',.42);else dot(x,y,i%8===0?3:1,'#a990b2',.42);
    }
    for(let i=0;i<3;i++)ellipse(width*[.13,.86,.73][i],height*[.25,.73,.15][i],s*.055,s*.055,0,'#b697bc',.35);
  }
  function render() {
    ctx.clearRect(0,0,width,height);const t=motion.matches?0:elapsed;
    if(style==='orbits'||style==='night')drawOrbits(t,style==='night');else if(style==='waves')drawWaves(t);else drawNebula(t);ctx.globalAlpha=1;
  }
  function draw(time: number) {
    frame=requestAnimationFrame(draw);if(document.hidden){last=time;return;}if(time-last<40)return;
    if(last)elapsed+=Math.min((time-last)/1000,.1);last=time;render();
  }
  window.addEventListener('resize',resize,{passive:true});resize();frame=requestAnimationFrame(draw);
  return {
    setStyle(next: SpaceStyle) { style=next;document.body.dataset.style=next;render(); },
    snapshot() { return {style,elapsed,renderer:'canvas-2d',pointerDriven:false}; },
    dispose() { cancelAnimationFrame(frame);window.removeEventListener('resize',resize);canvas.remove(); },
  };
}
