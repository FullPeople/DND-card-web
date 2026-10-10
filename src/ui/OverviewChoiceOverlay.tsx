import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import type {Character,Entry} from '../core/model';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';
import {ChoiceWorkspace} from './ChoiceWorkspace';
import './overviewChoiceOverlay.css';

/** Cover the existing panels without changing their paper or responsive grid. */
export function OverviewChoiceOverlay({c,catalog,edit}:{c:Character;catalog:Entry[];edit:(action:(c:Character)=>void)=>void}){
 const workspace=useChoiceWorkspace();
 return workspace.id&&workspace.coverOverview&&workspace.canEdit!==false?<OpenOverlay key={c.id} c={c} catalog={catalog} edit={edit} id={workspace.id} close={workspace.close}/>:null;
}
function OpenOverlay({c,catalog,edit,id,close}:{c:Character;catalog:Entry[];edit:(action:(c:Character)=>void)=>void;id:string;close:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[bounds,setBounds]=useState<CSSProperties>();
 useLayoutEffect(()=>{
  const overlay=ref.current,root=overlay?.closest<HTMLElement>('.overview-sheet');if(!root)return;
  const panels=Array.from(root.querySelectorAll<HTMLElement>('.quickbar-cell,.class-features,.heritage-features,.overview-spells')).filter(node=>!overlay?.contains(node));
  const originals=panels.map(node=>({node,inert:node.inert}));for(const {node} of originals)node.inert=true;
  let frame=0;
  const measure=()=>{frame=0;const base=root.getBoundingClientRect(),boxes=panels.map(node=>node.getBoundingClientRect()).filter(box=>box.width&&box.height);if(!boxes.length||!root.offsetWidth)return;
   const scale=base.width/root.offsetWidth,left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom));
   setBounds({left:(left-base.left)/scale,top:(top-base.top)/scale,width:(right-left)/scale,height:(bottom-top)/scale});
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  measure();const observer=new ResizeObserver(schedule);observer.observe(root);for(const panel of panels)observer.observe(panel);window.addEventListener('resize',schedule);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);for(const {node,inert} of originals)node.inert=inert;};
 },[]);
 useLayoutEffect(()=>{if(bounds)ref.current?.querySelector<HTMLButtonElement>('.choice-exit')?.focus({preventScroll:true});},[!!bounds]);
 return <div ref={ref} className="overview-choice-overlay" style={bounds||{visibility:'hidden'}} role="region" aria-label="角色卡填写"><ChoiceWorkspace key={id} c={c} catalog={catalog} edit={edit} id={id} close={close}/></div>;
}
