import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
type Item={id:string;node:ReactNode};
const three=[['initiative','passive','str','int'],['speed','dex','wis'],['size','con','cha','proficiency','saves']];
const two=[['initiative','passive','str','int','cha','proficiency','saves'],['speed','size','dex','con','wis']];
/** Pack independent columns while keeping component identities and focused drafts. */
export function ScreenAbilities({items}:{items:Item[]}){
  const root=useRef<HTMLDivElement>(null);
  const [layout,setLayout]=useState<{height:number;positions:Record<string,{top:number;column:number}>}>({height:0,positions:{}});
  const ids=items.map(item=>item.id).join(':');
  useLayoutEffect(()=>{
    const region=root.current!;let pending=0;
    const place=()=>{
      pending=0;
      const columns=Number(getComputedStyle(region).getPropertyValue('--ability-columns'))||3;
      const groups=columns===2?two:three,positions:Record<string,{top:number;column:number}>={};
      const heights=groups.map((group,column)=>{let top=0;for(const id of group){const node=region.querySelector<HTMLElement>(`[data-screen-ability="${id}"]`);if(!node)continue;positions[id]={top,column};top+=node.offsetHeight+4;}return Math.max(0,top-4);});
      const next={height:Math.max(...heights),positions};
      setLayout(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const schedule=()=>{if(!pending)pending=requestAnimationFrame(place);};
    const observer=new ResizeObserver(schedule);observer.observe(region);for(const item of region.children)observer.observe(item);place();
    return()=>{observer.disconnect();cancelAnimationFrame(pending);};
  },[ids]);
  return <div className="screen-abilities" ref={root} style={{height:layout.height||undefined}}>{items.map(item=><div className="screen-ability-item" data-screen-ability={item.id} key={item.id} style={{top:layout.positions[item.id]?.top||0,left:`calc(${layout.positions[item.id]?.column||0} * (100% + 4px) / var(--ability-columns))`}}>{item.node}</div>)}</div>;
}
