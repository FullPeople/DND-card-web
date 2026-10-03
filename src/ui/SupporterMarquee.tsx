import {useEffect,useState,type CSSProperties} from 'react';
import {SUPPORTER_SPEED_PX_PER_SECOND,supporterFlightTiming} from './supporterMarqueeMotion';
import './supporterMarquee.css';
type Supporter={name:string;amount:number};
type Flight=Supporter&{id:number;lane:number;top:number;duration:number;delay:number;color:string;size:number;avatar?:string};
const avatars: Record<string,string> = {
  "Dino":                       "supporter-avatars/Dino.jpg",
  "St.Monk":                    "supporter-avatars/St_Monk.png",
  "lingkkkkuang":               "supporter-avatars/lingkkkkuang.png",
  "不周":                        "supporter-avatars/不周.png",
  "凸守早苗":                    "supporter-avatars/凸守早苗.png",
  "咖啡":                        "supporter-avatars/咖啡.png",
  "姜川安.":                     "supporter-avatars/姜川安.jpg",
  "折云":                        "supporter-avatars/折云.jpg",
  "桌角剧团的囧神":              "supporter-avatars/桌角剧团的囧神.png",
  "武御":                        "supporter-avatars/武御.png",
  "蚀星ErosionStar":             "supporter-avatars/蚀星Erosionstar.png",
  "跑冰风谷水群被抓的某位":      "supporter-avatars/跑冰风谷水群被抓的某位.png",
  "鱼喵":                        "supporter-avatars/鱼喵.png",
  "克雷锰特":                    "supporter-avatars/克雷锰特.png",
  "xhchi_小火车":                "supporter-avatars/xhchi_小火车.png",
};
const colors=['#f59e0b','#fb4265','#00b9c7','#278cff','#a348ed','#69c522','#ed42a3','#ff772f'];
let listPromise:Promise<Supporter[]>|undefined;
const load=()=>listPromise||=(fetch('./support/supporters.json').then(r=>{if(!r.ok)throw Error('supporters');return r.json();}).then(v=>Array.isArray(v)?v.filter(s=>s&&typeof s.name==='string').map(s=>({name:s.name,amount:Math.max(0,Number(s.amount)||0)})):[]).catch(()=>{listPromise=undefined;return [];}));
export function SupporterMarquee({fullScreen=false}:{fullScreen?:boolean}){
 const [flights,setFlights]=useState<Flight[]>([]);
 const [reducedMotion,setReducedMotion]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const preference=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReducedMotion(preference.matches);update();preference.addEventListener('change',update);return()=>preference.removeEventListener('change',update);},[]);
 useEffect(()=>{let stopped=false,serial=0,index=0,nextLane:number[]=[],timer:ReturnType<typeof setTimeout>|undefined,resize:(()=>void)|undefined;const timers=new Set<ReturnType<typeof setTimeout>>();
 setFlights([]);if(reducedMotion)return;
 void load().then(supporters=>{if(stopped||!supporters.length)return;
 const shuffled=[...supporters];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const lanes=()=>Math.max(2,Math.floor(((fullScreen?innerHeight:190)-8)/60));
 const spawn=(lane:number,age=0)=>{
 const now=performance.now(),supporter=shuffled[index++%shuffled.length],size=Math.min(38,20+Math.sqrt(supporter.amount)),avatar=avatars[supporter.name],width=supporter.name.length*size+(avatar?size*1.5+7:0)+24,{duration,laneDelay}=supporterFlightTiming(innerWidth,width),id=++serial;
 nextLane[lane]=now+Math.max(0,laneDelay-age)+200+Math.random()*650;
 const flight={...supporter,id,lane,top:8+lane*60+Math.random()*3,duration,delay:-age,size,color:colors[Math.floor(Math.random()*colors.length)],avatar};setFlights(old=>[...old,flight]);
 const cleanup=setTimeout(()=>{timers.delete(cleanup);setFlights(old=>old.filter(v=>v.id!==id));},Math.max(0,duration-age)+100);timers.add(cleanup);
 };
 // Begin at different horizontal phases, then choose among cleared lanes.
 // This avoids the top-to-bottom staircase of a fixed spawn interval.
 const reset=()=>{for(const timeout of timers)clearTimeout(timeout);timers.clear();setFlights([]);nextLane=Array(lanes()).fill(0);for(let lane=0;lane<nextLane.length;lane++)spawn(lane,(.15+Math.random()*.6)*innerWidth/SUPPORTER_SPEED_PX_PER_SECOND*1000);};reset();resize=reset;window.addEventListener('resize',resize);
 const tick=()=>{if(stopped)return;if(!document.hidden){if(nextLane.length!==lanes())nextLane=Array(lanes()).fill(performance.now());const available=nextLane.flatMap((at,lane)=>at<=performance.now()?[lane]:[]);if(available.length)spawn(available[Math.floor(Math.random()*available.length)]);}timer=setTimeout(tick,150+Math.random()*420);};timer=setTimeout(tick,250+Math.random()*500);
 });return()=>{stopped=true;clearTimeout(timer);if(resize)window.removeEventListener('resize',resize);for(const timeout of timers)clearTimeout(timeout);};},[fullScreen,reducedMotion]);
 return <div className={'supporter-marquee '+(fullScreen?'is-fullscreen':'')} aria-hidden="true" data-supporter-marquee>{flights.map(f=><span key={f.id} className="supporter-flight" style={{'--flight-duration':`${f.duration}ms`,animationDelay:`${f.delay}ms`,top:f.top,color:f.color,fontSize:f.size} as CSSProperties}>{f.avatar&&<img fetchPriority="low" decoding="async" src={'./support/'+f.avatar} alt=""/>}{f.name}</span>)}</div>;
}
