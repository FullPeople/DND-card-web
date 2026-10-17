import {SIDEBAR_QUERY} from './device';
type Motion={x:number;y:number;angle:number;scale:number};
type Flight={started:number;out:boolean;closing:boolean;from:Motion[]};
const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const smooth=(p:number)=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)};

export class LogoExperience{
  private hero=$('#hero');private stage=$('.center-stage');private handle=$<HTMLButtonElement>('#molecule-handle');private hit=$<HTMLButtonElement>('#die-hit');private steam=$('#steam-card');private panel=$('#works-panel');
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private layers=[
    {element:$('#hero-base'),x:0,y:30,angle:-9,delay:0,amp:5,period:9,phase:0,origin:'49% 66%'},
    {element:$('#hero-person'),x:-33,y:-10,angle:-19,delay:.12,amp:10,period:6.5,phase:.7,origin:'31% 37%'},
    {element:$('#hero-molecule'),x:10,y:-33,angle:22,delay:.24,amp:12,period:5,phase:1.4,origin:'52% 28%'},
    {element:$('#hero-die'),x:34,y:-16,angle:55,delay:.36,amp:13,period:5.3,phase:2.1,origin:'75% 26.9%'},
  ];
  private motions:Motion[]=this.layers.map(()=>({x:0,y:0,angle:0,scale:1}));
  private ready=false;private started=0;private introCount=0;private initialized=false;private introTimer=0;
  private works=false;private docked=false;private detailWanted=false;private flight:Flight|null=null;private hovered=false;private hoverAt=0;private paused=0;private frozen:Motion|null=null;
  private chargeStarted=0;private locked=false;private exploded=false;private recoveryStarted=0;private revealScale=1;private chargeOrigin:Motion={x:0,y:0,angle:0,scale:1};
  private spinReturn:{started:number;from:Motion}|null=null;
  constructor(private onIntro:()=>void,private onRoll:()=>void,private onError:(message:string)=>void){
    this.layers.forEach(layer=>layer.element.style.transformOrigin=layer.origin);
    $('#skip-intro').addEventListener('click',()=>this.finishIntro());$('#replay').addEventListener('click',()=>this.replay());
    this.handle.addEventListener('pointerenter',()=>this.freeze());this.handle.addEventListener('pointerleave',()=>this.unfreeze());
    this.handle.addEventListener('click',()=>this.openWorks());$('#close-works').addEventListener('click',()=>this.closeWorks());
    $('#logo-return').addEventListener('click',()=>this.closeWorks());
    this.hit.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')this.startCharge()});this.hit.addEventListener('pointerleave',()=>this.cancelHover());
    this.hit.addEventListener('focus',()=>this.startCharge());this.hit.addEventListener('blur',()=>this.cancelHover());
    this.hit.addEventListener('click',()=>{this.startCharge();if(this.chargeStarted)this.locked=true;this.onRoll()});
    $('#reset-die').addEventListener('click',()=>this.restoreDie());
    for(const [selector,layer,x,y] of [['#make-card','person',-45,-10],['#library','base',0,40]] as const){
      const entry=$(selector),pull=(active:boolean)=>{this.hero.style.setProperty(`--${layer}-x`,`${active?x:0}px`);this.hero.style.setProperty(`--${layer}-y`,`${active?y:0}px`)};
      entry.addEventListener('pointerenter',()=>pull(true));entry.addEventListener('pointerleave',()=>pull(false));entry.addEventListener('focus',()=>pull(true));entry.addEventListener('blur',()=>pull(false));
    }
    this.syncLayout();
    window.addEventListener('resize',()=>{this.placeSteam();this.syncLayout()});window.addEventListener('blur',()=>this.cancelHover());
    window.addEventListener('dnd-project-detail',event=>{this.detailWanted=!!(event as CustomEvent).detail;this.syncDock()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector<HTMLDialogElement>('#about-dialog')?.open){this.closeWorks();this.restoreDie()}});
    Promise.all(this.layers.map(layer=>new Promise<void>((resolve,reject)=>{
      const image=layer.element as HTMLImageElement;
      const decoded=()=>{if(!image.naturalWidth){reject(Error('图片无法加载'));return;}if(image.decode)void image.decode().catch(()=>{}).then(()=>resolve());else resolve();};
      if(image.complete){decoded();return}
      image.addEventListener('load',decoded,{once:true});image.addEventListener('error',()=>reject(Error('图片无法加载')),{once:true});
    }))).then(()=>{this.ready=true;this.replay()}).catch(error=>{document.body.dataset.intro='complete';document.body.classList.remove('intro-active');this.syncLayout();this.onError('开屏图片加载失败：'+String(error))});
    requestAnimationFrame(this.frame);
  }
  private replay(){
    if(!this.ready)return;this.resetDie();this.unfreeze();this.paused=0;this.works=false;this.docked=false;this.detailWanted=false;this.flight=null;this.panel.hidden=true;this.panel.inert=true;this.panel.classList.remove('visible');
    this.panel.dataset.detail='false';window.dispatchEvent(new Event('dnd-project-close'));
    this.handle.setAttribute('aria-expanded','false');document.body.classList.remove('works-open','logo-travelling','logo-docked');
    this.hero.style.setProperty('--person-x','0px');this.hero.style.setProperty('--person-y','0px');this.hero.style.setProperty('--base-x','0px');this.hero.style.setProperty('--base-y','0px');
    clearTimeout(this.introTimer);this.started=performance.now();this.introCount++;document.body.dataset.intro='playing';document.body.classList.add('intro-active');this.draw(this.started);if(this.reduced)queueMicrotask(()=>this.finishIntro());else this.introTimer=window.setTimeout(()=>this.finishIntro(),2350);
  }
  private finishIntro(){
    if(document.body.dataset.intro!=='playing')return;clearTimeout(this.introTimer);
    document.body.dataset.intro='complete';document.body.classList.remove('intro-active');
    if(!this.initialized){this.initialized=true;this.onIntro()}
    this.syncLayout();
  }
  private freeze(){if(!this.ready||this.projectsFocused()||this.flight||this.hovered||document.body.dataset.intro!=='complete')return;this.hovered=true;this.hoverAt=performance.now();this.frozen={...this.motions[2]};this.hero.classList.add('molecule-hover')}
  private unfreeze(){if(!this.hovered)return;this.paused+=performance.now()-this.hoverAt;this.hovered=false;this.frozen=null;this.hero.classList.remove('molecule-hover')}
  private wide(){return matchMedia(SIDEBAR_QUERY).matches}
  private projectsFocused(){return this.works&&(!this.wide()||this.detailWanted)}
  private syncLayout(){
    const wasWide=document.body.dataset.projectLayout==='wide',wide=this.wide();
    document.body.dataset.projectLayout=wide?'wide':'narrow';
    if(document.body.dataset.intro!=='complete')return;
    if(wide){if(!this.works)this.openWorks();else this.syncDock()}
    else if(wasWide&&this.works&&!this.detailWanted)this.closeWorks();
    else this.syncDock();
  }
  openWorks(){
    if(this.works||this.flight||document.body.dataset.intro!=='complete')return;
    this.works=true;this.detailWanted=false;this.unfreeze();this.handle.blur();this.panel.hidden=false;this.panel.inert=false;
    document.body.classList.add('works-open');this.handle.setAttribute('aria-expanded','true');
    if(this.wide()){void this.panel.offsetHeight;this.panel.classList.add('visible')}
    this.syncDock();
  }
  closeWorks(){
    if(!this.works)return;
    if(this.wide()){
      this.detailWanted=false;window.dispatchEvent(new Event('dnd-project-close'));
      if(this.docked||this.flight)this.beginFlight(false);return;
    }
    this.panel.classList.remove('visible');this.panel.inert=true;this.detailWanted=false;this.handle.setAttribute('aria-expanded','false');
    if(this.docked||this.flight)this.beginFlight(false,true);
    else{this.works=false;document.body.classList.remove('works-open');setTimeout(()=>{if(!this.works)this.panel.hidden=true},320)}
  }
  private syncDock(){if(!this.works||this.flight)return;const wanted=this.detailWanted||!this.wide();if(wanted!==this.docked)this.beginFlight(wanted)}
  private beginFlight(out:boolean,closing=false){
    this.unfreeze();this.handle.blur();this.flight={started:performance.now(),out,closing,from:this.motions.map(m=>({...m}))};this.hero.classList.remove('molecule-hover');document.body.classList.add('logo-travelling');
    if(this.reduced){this.flight.started-=2000;this.draw(performance.now())}
  }
  private idle(index:number,time:number,size:number):Motion{
    const layer=this.layers[index],elapsed=(time-this.started-(index===2?this.paused:0))/1000;
    if(this.reduced)return{x:0,y:0,angle:0,scale:1};
    const result={x:Math.sin(elapsed*.55+layer.phase)*[1.2,2,4,3][index],y:(Math.sin(elapsed*Math.PI*2/layer.period+layer.phase)-Math.sin(layer.phase))*layer.amp,angle:Math.sin(elapsed*.6+layer.phase)*[.5,1.2,2,4][index],scale:1};
    if(index===2&&((!this.projectsFocused()&&!this.flight)||(this.flight&&!this.flight.out))){
      const phase=(elapsed%27-8)/6;
      if(phase>0&&phase<1){const a=smooth(phase)*Math.PI*2;result.x+=size*.43*Math.sin(a);result.y+=size*.26*(1-Math.cos(a));result.angle+=14*Math.sin(a)}
    }
    return result;
  }
  private draw(time:number){
    const size=this.hero.clientWidth,rect=this.stage.getBoundingClientRect(),cornerSize=innerWidth<=700?Math.min(76,innerWidth*.20):Math.min(170,innerWidth*.15,innerHeight*.20),cornerScale=cornerSize/size;
    const cornerY=innerWidth<=700?$('#library').getBoundingClientRect().top-cornerSize-20:innerHeight-cornerSize-22;
    const target={x:(innerWidth<=700?12:24)-rect.left,y:cornerY-rect.top};
    const intro=document.body.dataset.intro==='playing',elapsed=(time-this.started)/1000;
    const flight=this.flight;
    const durations=[.52,.66,.74,.60],delays=[0,.04,.02,.06],bends=[[-30,65],[65,-85],[-75,-105],[85,45]],spins=[-18,32,-65,80];
    for(let index=0;index<this.layers.length;index++){
      const layer=this.layers[index];let motion=this.idle(index,time,size);
      if(index===2&&this.hovered&&this.frozen&&!flight)motion={...this.frozen};
      if(index===3&&this.chargeStarted){const t=(time-this.chargeStarted)/1000;motion={x:this.chargeOrigin.x,y:this.chargeOrigin.y,angle:this.chargeOrigin.angle+t*2+.6*t**5,scale:1}}
      else if(index===3&&this.spinReturn){const from=this.spinReturn.from,p=this.reduced?1:smooth((time-this.spinReturn.started)/700),angle=from.angle+((motion.angle-from.angle+180)%360+360)%360-180;motion={x:from.x+(motion.x-from.x)*p,y:from.y+(motion.y-from.y)*p,angle:from.angle+(angle-from.angle)*p,scale:1};if(p>=1)this.spinReturn=null}
      if(intro){const p=Math.max(0,Math.min(1,(elapsed-layer.delay)/1.7)),ease=1-(1-p)**3;motion={x:(1-ease)*layer.x*size/100+ease*motion.x,y:(1-ease)*layer.y*size/100+ease*motion.y,angle:(1-ease)*layer.angle+ease*motion.angle,scale:1}}
      if(flight){
        const p=Math.max(0,Math.min(1,((time-flight.started)/1000-delays[index])/durations[index])),ease=smooth(p),curve=Math.sin(Math.PI*p),from=flight.from[index];
        const scale=flight.out?cornerScale:1,x=motion.x*scale+(flight.out?target.x:0),y=motion.y*scale+(flight.out?target.y:0);
        motion={x:from.x+(x-from.x)*ease+bends[index][0]*curve,y:from.y+(y-from.y)*ease+bends[index][1]*curve,angle:from.angle+(motion.angle-from.angle)*ease+spins[index]*curve,scale:from.scale+(scale-from.scale)*ease};
        this.keepVisible(motion,index,size,rect);
      }else if(this.docked){motion.x=motion.x*cornerScale+target.x;motion.y=motion.y*cornerScale+target.y;motion.scale=cornerScale}
      this.motions[index]=motion;
      const [ox,oy]=this.origin(index,size),recover=index===3&&this.recoveryStarted?(this.reduced?1:smooth((time-this.recoveryStarted)/650)):1;
      if(index===3)this.revealScale=recover;
      layer.element.style.transform=`translate(${motion.x-ox*(1-motion.scale)}px,${motion.y-oy*(1-motion.scale)}px) rotate(${motion.angle}deg) scale(${motion.scale*recover})`;
      const handle=index===2?this.handle:index===3?this.hit:null;
      if(handle){handle.style.transform=layer.element.style.transform;handle.style.transformOrigin=index===2?`${size*.13}px ${size*.16}px`:`${size*.165}px ${size*.169}px`}
    }
    const returnButton=$('#logo-return'),base=this.motions[0];returnButton.style.transformOrigin=`${size*.5}px ${size*.5}px`;returnButton.style.transform=`translate(${base.x-size*.5*(1-base.scale)}px,${base.y-size*.5*(1-base.scale)}px) scale(${base.scale})`;
    if(flight&&time-flight.started>=800){
      this.docked=flight.out;this.flight=null;document.body.classList.remove('logo-travelling');document.body.classList.toggle('logo-docked',this.docked);
      if(flight.closing){this.works=false;this.panel.hidden=true;document.body.classList.remove('works-open');this.unfreeze();this.syncLayout()}
      else if(this.works){void this.panel.offsetHeight;this.panel.classList.add('visible');this.syncDock()}
    }
    if(this.recoveryStarted&&time-this.recoveryStarted>=650){this.recoveryStarted=0;this.hero.classList.remove('recovering')}
    if(intro&&time-this.started>=2350)this.finishIntro();
    if(this.chargeStarted&&time-this.chargeStarted>=5200)this.explode();
  }
  private frame=(time:number)=>{if(this.ready)this.draw(time);requestAnimationFrame(this.frame)};
  private origin(index:number,size:number){return[[.49,.66],[.31,.37],[.52,.28],[.75,.269]][index].map(v=>v*size)}
  private keepVisible(motion:Motion,index:number,size:number,rect:DOMRect){
    const [ox,oy]=this.origin(index,size),a=motion.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const corners=[[0,0],[size,0],[size,size],[0,size]].map(([x,y])=>[motion.scale*(ox+(x-ox)*c-(y-oy)*s),motion.scale*(oy+(x-ox)*s+(y-oy)*c)]);
    const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));
    motion.x=Math.max(8-rect.left-minX,Math.min(innerWidth-8-rect.left-maxX,motion.x));motion.y=Math.max(8-rect.top-minY,Math.min(innerHeight-8-rect.top-maxY,motion.y));
  }
  private startCharge(){if(document.body.dataset.intro!=='complete'||this.chargeStarted||this.exploded||this.recoveryStarted||this.projectsFocused()||this.flight)return;this.chargeOrigin={...this.motions[3]};this.spinReturn=null;this.chargeStarted=performance.now();this.hero.classList.add('charging')}
  private cancelHover(){if(!this.chargeStarted)return;this.spinReturn={started:performance.now(),from:{...this.motions[3]}};this.chargeStarted=0;this.locked=false;this.hero.classList.remove('charging')}
  private explode(){
    const rect=this.hit.getBoundingClientRect();this.chargeStarted=0;this.locked=false;this.exploded=true;this.hero.classList.remove('charging');this.hero.classList.add('exploded');
    this.burst(rect);
    this.steam.hidden=false;this.placeSteam();document.body.dataset.dice='exploded';
  }
  private placeSteam(){if(this.steam.hidden)return;const rect=this.hit.getBoundingClientRect(),space=$('#space').getBoundingClientRect(),margin=20;this.steam.style.left=`${Math.max(margin,Math.min(innerWidth-this.steam.offsetWidth-margin,rect.left+rect.width*.5-50))}px`;this.steam.style.top=`${Math.max(90,Math.min(innerHeight-100-this.steam.offsetHeight,rect.top+rect.height*.5-70))-space.top}px`}
  private burst(rect:DOMRect){for(let i=0;i<32;i++){const dot=document.createElement('i');dot.className='burst-particle';const a=i*Math.PI*2/32,r=70+Math.random()*150;for(const [k,v]of Object.entries({'--x':`${rect.left+rect.width*.5}px`,'--y':`${rect.top+rect.height*.5}px`,'--dx':`${Math.cos(a)*r}px`,'--dy':`${Math.sin(a)*r}px`,'--c':['#a5baff','#f6e08e','#bfd7a6','#e7aec9'][i%4]}))dot.style.setProperty(k,v);document.body.append(dot);setTimeout(()=>dot.remove(),1000)}}
  private restoreDie(){if(!this.exploded)return;this.burst(this.hit.getBoundingClientRect());this.resetDie();this.recoveryStarted=performance.now();this.hero.classList.add('recovering');this.draw(this.recoveryStarted)}
  private resetDie(){this.chargeStarted=0;this.locked=false;this.spinReturn=null;this.exploded=false;this.recoveryStarted=0;this.revealScale=1;this.hero.classList.remove('charging','exploded','recovering');this.steam.hidden=true;document.body.dataset.dice='floating'}
  snapshot(){return{intro:document.body.dataset.intro,introCount:this.introCount,introStarted:this.started,chargeStarted:this.chargeStarted,chargeLocked:this.locked,spinReturning:!!this.spinReturn,exploded:this.exploded,recovering:!!this.recoveryStarted,dieRevealScale:this.revealScale,worksOpen:this.works,docked:this.docked,travelling:!!this.flight,moleculeHovered:this.hovered,moleculeClock:(performance.now()-this.started-this.paused-(this.hovered?performance.now()-this.hoverAt:0))/1000,motions:this.motions.map(m=>({...m}))}}
}
