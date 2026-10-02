import {useEffect,useState,type CSSProperties} from 'react';
import {supporterFlightTiming} from './supporterMarqueeMotion';
import './supporterMarquee.css';
type Supporter={name:string;amount:number};
type Flight=Supporter&{id:number;lane:number;duration:number;color:string;size:number;avatar?:string};
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
const colors=['#81591c','#a94732','#287f75','#356ca9','#8353a5','#568425','#af426e','#93661f'];
let listPromise:Promise<Supporter[]>|undefined;
const load=()=>listPromise||=(fetch('./support/supporters.json').then(r=>{if(!r.ok)throw Error('supporters');return r.json();}).then(v=>Array.isArray(v)?v.filter(s=>s&&typeof s.name==='string').map(s=>({name:s.name,amount:Math.max(0,Number(s.amount)||0)})):[]).catch(()=>{listPromise=undefined;return [];}));
export function SupporterMarquee({fullScreen=false}:{fullScreen?:boolean}){
 const [flights,setFlights]=useState<Flight[]>([]);
 const [reducedMotion,setReducedMotion]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const preference=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReducedMotion(preference.matches);update();preference.addEventListener('change',update);return()=>preference.removeEventListener('change',update);},[]);
 useEffect(()=>{let stopped=false,serial=0,index=0,nextLane:number[]=[],timer:ReturnType<typeof setInterval>|undefined;const timers=new Set<ReturnType<typeof setTimeout>>();
 setFlights([]);if(reducedMotion)return;
 void load().then(supporters=>{if(stopped||!supporters.length)return;
 const spawn=()=>{if(document.hidden)return;const now=performance.now(),lanes=Math.max(2,Math.floor((fullScreen?innerHeight:190)/52));if(nextLane.length!==lanes)nextLane=Array(lanes).fill(0);const lane=nextLane.indexOf(Math.min(...nextLane));if(nextLane[lane]>now)return;
 const supporter=supporters[index++%supporters.length],size=Math.min(30,15+Math.sqrt(supporter.amount)),width=Math.min(700,supporter.name.length*size+size+24),{duration,laneDelay}=supporterFlightTiming(innerWidth,width),id=++serial;
 nextLane[lane]=now+laneDelay;
 const avatar=avatars[supporter.name],flight={...supporter,id,lane,duration,size,color:colors[(index-1)%colors.length],avatar};setFlights(old=>[...old,flight]);
 const cleanup=setTimeout(()=>{timers.delete(cleanup);setFlights(old=>old.filter(v=>v.id!==id));},duration+100);timers.add(cleanup);
 };
 spawn();timer=setInterval(spawn,180);
 });return()=>{stopped=true;clearInterval(timer);for(const timeout of timers)clearTimeout(timeout);};},[fullScreen,reducedMotion]);
 return <div className={'supporter-marquee '+(fullScreen?'is-fullscreen':'')} aria-hidden="true" data-supporter-marquee>{flights.map(f=><span key={f.id} className="supporter-flight" style={{'--flight-duration':`${f.duration}ms`,top:8+f.lane*52,color:f.color,fontSize:f.size} as CSSProperties}>{f.avatar&&<img fetchPriority="low" decoding="async" src={'./support/'+f.avatar} alt=""/>}{f.name}</span>)}</div>;
}
