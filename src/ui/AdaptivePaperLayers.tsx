import {useEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {AdaptiveFrameArt} from './AdaptiveCardAtmosphere';
import type {ConditionVisual} from './conditionVisuals';
import './adaptivePaper.css';

const frameSelector='.sheet-cell,[data-physical-frame],.monster-ability-group,.monster-section,.monster-defenses';
const monsterBodySelector='.suite-vitals,.monster-ability-group,.monster-section,.monster-defenses,.stock-item,.stock-empty';

/** Attach decoration to the real frame boxes, including dynamically loaded inventory.
 * The original A4 SheetCell and its presentation context remain untouched. */
export function AdaptivePaperLayers({paper,active,exhaustion,editing,layoutKey}:{
 paper:RefObject<HTMLDivElement|null>;active:ReadonlySet<ConditionVisual>;exhaustion:number;editing:boolean;layoutKey:string;
}){
 const [frames,setFrames]=useState<HTMLElement[]>([]);
 const keys=useRef(new WeakMap<HTMLElement,string>()),nextKey=useRef(0);
 useEffect(()=>{
  const root=paper.current;if(!root)return;
  const marked=new Map<HTMLElement,Set<string>>();
  const mark=(node:HTMLElement,name:string)=>{node.setAttribute(name,'');const names=marked.get(node)||new Set<string>();names.add(name);marked.set(node,names);};
  const scan=()=>{
   const nodes=[...root.querySelectorAll<HTMLElement>(frameSelector)];
   for(const node of nodes){
    if(!keys.current.has(node))keys.current.set(node,String(++nextKey.current));
    mark(node,'data-adaptive-frame');
    if(!node.closest('.workbench-monster')&&!node.parentElement?.closest(frameSelector))mark(node,'data-adaptive-physical');
   }
   root.querySelectorAll<HTMLElement>('.workbench-monster').forEach(monster=>monster.querySelectorAll<HTMLElement>(monsterBodySelector).forEach(node=>mark(node,'data-adaptive-physical')));
   root.querySelectorAll<HTMLElement>('.portrait-cell,.workbench-monster>header .assign-token-name').forEach(node=>mark(node,'data-adaptive-prone'));
   root.querySelectorAll<HTMLElement>('.portrait-view').forEach(node=>mark(node,'data-adaptive-portrait'));
   root.querySelectorAll<HTMLElement>('.speed-cell,.monster-basics>div>p:last-child').forEach(node=>mark(node,'data-adaptive-speed'));
   root.querySelectorAll<HTMLElement>('.initiative-cell,.monster-initiative').forEach(node=>mark(node,'data-adaptive-initiative'));
   setFrames(old=>old.length===nodes.length&&old.every((node,index)=>node===nodes[index])?old:nodes);
  };
  scan();const observer=new MutationObserver(scan);observer.observe(root,{childList:true,subtree:true});
  return()=>{observer.disconnect();for(const [node,names] of marked)for(const name of names)node.removeAttribute(name);};
 },[paper,layoutKey]);
 return frames.map(node=>createPortal(<AdaptiveFrameArt active={node.classList.contains('cell-missing')?new Set([...active].filter(id=>id!=='invisible')):active} exhaustion={exhaustion} editing={editing} outline={false}/>,node,keys.current.get(node)));
}
