import type {DiceRenderer,AudioPlan} from './dice/renderer';
import {RollAudioMixer} from './dice/audio-mixer';
import {materialCatalog,presentationTheme} from './dice/material-styles';
import {buildCue,type Cue} from './dice/cue';
import {now,type Catalog,type Roll,type Request,type Kind,type ThemeID} from './dice/types';
import {applyDiceStrategy,rollLabel,type RollMode} from './dice-strategy';

export type {RollMode} from './dice-strategy';

export class DiceExperience{
  private worker!:Worker;
  private preparation:Promise<void>=Promise.resolve();private queued=0;
  private catalog!:Catalog;private renderer!:DiceRenderer;
  private audio=new RollAudioMixer((event,detail:any)=>this.report(event,detail));
  private pending=new Map<string,{resolve:(value:any)=>void,reject:(error:Error)=>void,timer:number}>();
  private ready=false;private muted=false;private fatal='';
  private rolls=new Map<string,{roll:Roll,mode:RollMode,total:number,start:number,end:number}>();
  private initPromise?:Promise<void>;
  readonly events:{at:number,event:string,detail:any}[]=[];
  constructor(private stage:HTMLElement,private onEvent:(event:string,detail:any)=>void){
  }
  private connectWorker(worker:Worker){
    worker.onmessage=event=>{const data=event.data,key=data.type==='warm'?'warm':data.id,pending=this.pending.get(key);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(key);if(data.error)pending.reject(Error(data.error));else pending.resolve(data.roll??data)};
    worker.onerror=event=>{this.fatal=event.message||'骰子计算器无法加载，请重新加载页面。';this.ready=false;for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(Error(this.fatal))}this.pending.clear();this.report('error',{message:this.fatal})};
  }
  private report(event:string,detail:any){this.events.push({at:performance.now(),event,detail});if(this.events.length>200)this.events.shift();this.onEvent(event,detail)}
  private message(key:string,data:any,worker=this.worker){return new Promise<any>((resolve,reject)=>{const timer=window.setTimeout(()=>{this.pending.delete(key);reject(Error('骰子准备超时，请重新加载页面'))},40000);this.pending.set(key,{resolve,reject,timer});worker.postMessage(data)})}
  init(){return this.initPromise??=this.initialize()}
  private async initialize(){
    this.worker=new Worker(new URL('./dice/physics.worker.ts',import.meta.url),{type:'module'});
    this.connectWorker(this.worker);
    const [{DiceRenderer},{loadTriangleTheme},response]=await Promise.all([import('./dice/renderer'),import('./triangle-theme'),fetch('/assets/catalog.json')]);
    if(!response.ok)throw Error('骰子素材加载失败');const source=materialCatalog(await response.json());
    const triangle=await loadTriangleTheme(source);
    this.catalog={...source,themes:{ink_sketch:source.themes.ink_sketch,godot_blue_cat_eye:source.themes.godot_blue_cat_eye,gray_red_three_cap:triangle} as Catalog['themes']};
    this.audio.setCatalog(this.catalog);
    const font=new FontFace('CinzelVariable','url(/assets/fonts/Cinzel-Variable.ttf)',{weight:'400 900'});await font.load();document.fonts.add(font);
    this.renderer=new DiceRenderer(this.stage,this.catalog,(event,detail)=>{
      if(event==='render-queued'){this.audio.prepare(detail.roll,this.rolls.get(detail.roll)!.roll.request.theme,detail.audio as AudioPlan)}
      if(event==='render-release')void this.audio.release(detail.roll,detail.planned).catch(error=>this.report('error',{message:String(error)}));
      if(event==='render-complete'||event==='render-cancelled'){this.worker.postMessage({type:'release',id:detail.roll});this.audio.stop(detail.roll);this.rolls.delete(detail.roll)}
      if(event==='error'){this.fatal=detail.message;this.ready=false}
      this.report(event,detail);
    });
    await Promise.all([this.renderer.init([{theme:'ink_sketch',kinds:['d20']},{theme:'godot_blue_cat_eye',kinds:['d_percentile','d10']},{theme:'gray_red_three_cap',kinds:['d4']}]),this.message('warm',{type:'warmup',catalog:this.catalog,view:{w:innerWidth,h:innerHeight}}),this.audio.warmup(['ink_sketch'])]);
    this.audio.setVolume(this.muted?0:.38);this.ready=true;this.report('ready',{});
  }
  async roll(mode:RollMode){
    if(this.fatal)throw Error(this.fatal);const actual=mode==='random'?(['d20','d100','6d4'] as RollMode[])[crypto.getRandomValues(new Uint32Array(1))[0]%3]:mode;
    const unlock=this.audio.unlock();await this.init();await unlock;
    await this.audio.warmup([actual==='d100'?'godot_blue_cat_eye':actual==='6d4'?'gray_red_three_cap':'ink_sketch']);
    if(this.rolls.size+this.queued>=8)throw Error('桌面上已有 8 次投掷，等一会儿再试。');
    this.queued++;
    const task=this.preparation.then(()=>this.prepareRoll(actual));
    this.preparation=task.then(()=>{},()=>{});
    return task.finally(()=>this.queued--);
  }
  private async prepareRoll(actual:RollMode){
    if(this.fatal)throw Error(this.fatal);
    const upcoming=Math.max(0,...[...this.rolls.values()].map(item=>item.start));
    if(upcoming>now())await new Promise(resolve=>setTimeout(resolve,upcoming-now()+1));
    const kinds:Kind[]=actual==='d100'?['d_percentile','d10']:actual==='6d4'?Array(6).fill('d4'):['d20'];
    const theme:ThemeID=actual==='d100'?'godot_blue_cat_eye':actual==='6d4'?'gray_red_three_cap':'ink_sketch';
    const label=rollLabel(actual);
    const request:Request={id:crypto.randomUUID(),source:'local-formula-research',name:label,kind:'mixed',count:kinds.length,theme,seed:crypto.getRandomValues(new Uint32Array(1))[0],bodyColor:actual==='d20'?'#b6cbf5':actual==='d100'?'#72aee8':undefined};
    this.report('preparing',{id:request.id,mode:actual,label});
    let roll:Roll;try{roll=await this.message(request.id,{type:'research-wave',request,kinds,catalog:this.catalog,view:{w:innerWidth,h:innerHeight}})}catch(error){this.worker.postMessage({type:'release',id:request.id});throw error}
    if(roll.kinds.length!==kinds.length||roll.kinds.some((kind,i)=>kind!==kinds[i]))throw Error('返回的骰子组合不匹配');
    const cue=applyDiceStrategy(buildCue(roll,this.renderer.projection,presentationTheme(this.catalog.themes[theme],request.bodyColor)),roll,actual,this.renderer.projection);
    // Reuse the existing shared-world contract: a new trace hits retained dice at their
    // authoritative rest positions, after their displayed flight has actually reached them.
    const start=Math.max(now()+35,...[...this.rolls.values()].map(item=>item.start+item.roll.duration*1000));
    this.rolls.set(request.id,{roll,mode:actual,total:cue.total,start,end:start+cue.diceExit*1000});
    this.renderer.add(roll,start,{cue});
    this.report('submitted',{id:request.id,mode:actual,label,theme,results:roll.results,total:cue.total,start,duration:roll.duration,frames:roll.frames,physicsMs:roll.physicsMs,diagnostics:roll.diagnostics,dieContacts:roll.contacts.filter(contact=>contact.kind===1).length,sharedWorld:true,presentation:{beams:cue.beams.map(beam=>({dieIndex:beam.dieIndex,start:beam.start,reveal:beam.reveal})),celebration:cue.celebration,underDice:cue.underDice?.map(die=>die.dieIndex)}});
    window.setTimeout(()=>this.report('result',{id:request.id,label,total:cue.total,results:roll.results}),Math.max(0,start+cue.finalReveal*1000-now()));
    return {id:request.id,mode:actual,total:cue.total,results:roll.results};
  }
  setMuted(muted:boolean){this.muted=muted;this.audio.setVolume(muted?0:.38)}
  snapshot(){return {ready:this.ready,muted:this.muted,pending:this.pending.size,queued:this.queued,active:this.rolls.size,workers:this.worker?1:0,sharedWorld:true,audio:this.audio.snapshot(),events:this.events}};
}
