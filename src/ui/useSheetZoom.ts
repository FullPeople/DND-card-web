import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
type View={zoom:number;x:number;y:number};
export function useSheetZoom(ref:RefObject<HTMLDivElement|null>,identity:string){
 const [view,setView]=useState<View>({zoom:1,x:0,y:0}),current=useRef(view);current.current=view;
 const reset=useCallback(()=>setView({zoom:1,x:0,y:0}),[]);
 useLayoutEffect(reset,[identity]);
 useEffect(()=>{window.addEventListener('sheet-fullscreen-change',reset);return()=>window.removeEventListener('sheet-fullscreen-change',reset);},[reset]);
 useEffect(()=>{const root=ref.current;if(!root)return;let start:{distance:number;x:number;y:number;view:View;cx:number;cy:number}|undefined,lastY=0,scroller:HTMLElement|null=null,suppressUntil=0;
 const pair=(t:TouchList)=>({distance:Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
 const begin=(e:TouchEvent)=>{if(root.classList.contains('sheet-reflow'))return;if(e.touches.length===2){e.preventDefault();window.dispatchEvent(new Event('sheet-gesture'));const rect=(root.querySelector('.paper-stack')||root).getBoundingClientRect();start={...pair(e.touches),view:current.current,cx:rect.x+rect.width/2-current.current.x,cy:rect.y+rect.height/2-current.current.y};suppressUntil=Date.now()+600;}else if(e.touches.length===1){lastY=e.touches[0].clientY;scroller=(e.target as Element).closest<HTMLElement>('.cell-content,.box-content,.feature-page-body,.detail-page-body');while(scroller&&scroller.scrollHeight<=scroller.clientHeight)scroller=scroller.parentElement?.closest<HTMLElement>('.cell-content,.box-content')||null;}};
 const move=(e:TouchEvent)=>{if(root.classList.contains('sheet-reflow'))return;if(start&&e.touches.length>=2){e.preventDefault();e.stopPropagation();const point=pair(e.touches),zoom=Math.max(1,Math.min(3.5,start.view.zoom*point.distance/start.distance)),ratio=zoom/start.view.zoom;const x=point.x-start.cx-(start.x-start.cx-start.view.x)*ratio,y=point.y-start.cy-(start.y-start.cy-start.view.y)*ratio;const rect=root.getBoundingClientRect();setView({zoom,x:Math.max(-rect.width*(zoom-1)/2,Math.min(rect.width*(zoom-1)/2,x)),y:Math.max(-rect.height*(zoom-1)/2,Math.min(rect.height*(zoom-1)/2,y))});suppressUntil=Date.now()+600;}else if(!start&&e.touches.length===1&&scroller&&!root.querySelector('.visual-editing')){const y=e.touches[0].clientY,delta=lastY-y;if(Math.abs(delta)>2){e.preventDefault();window.dispatchEvent(new Event('sheet-gesture'));scroller.scrollTop+=delta/current.current.zoom;lastY=y;}}};
 const end=()=>{if(start){suppressUntil=Date.now()+400;start=undefined;}};
 const click=(e:MouseEvent)=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
 root.addEventListener('touchstart',begin,{passive:false,capture:true});root.addEventListener('touchmove',move,{passive:false,capture:true});root.addEventListener('touchend',end);root.addEventListener('touchcancel',end);root.addEventListener('click',click,true);
 return()=>{root.removeEventListener('touchstart',begin,true);root.removeEventListener('touchmove',move,true);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',end);root.removeEventListener('click',click,true);};
 },[ref]);return {view,reset};
}
