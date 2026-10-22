import {useEffect,useRef} from 'react';
export function useNarrowWikiDrag(tab:string,change:(tab:string)=>void,cardVisible:boolean){
 const latest=useRef({tab,change,cardVisible});latest.current={tab,change,cardVisible};
 useEffect(()=>{let restore=false;
  const cancelReturn=()=>{restore=false;document.removeEventListener('click',navigate,true);};
  const start=(event:Event)=>{const source=(event as CustomEvent).detail?.source as Element|undefined;const current=latest.current;if(current.cardVisible&&current.tab==='wiki'&&matchMedia('(max-width:980px)').matches&&source?.closest('.wiki-pane')){restore=true;document.addEventListener('click',navigate,true);current.change('sheet');}};
  const end=()=>{if(restore){cancelReturn();latest.current.change('wiki');}};
  const navigate=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('.mobile-tabs button'))cancelReturn();};
  window.addEventListener('card-drag-start',start);window.addEventListener('card-drag-end',end);
  return()=>{window.removeEventListener('card-drag-start',start);window.removeEventListener('card-drag-end',end);cancelReturn();};
 },[]);
}
