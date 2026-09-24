import {useEffect,useRef,useState} from 'react';

export function exitSheetFullscreen(){document.querySelectorAll('.sheet-pane.sheet-fullscreen').forEach(pane=>pane.classList.remove('sheet-fullscreen'));window.dispatchEvent(new Event('sheet-fullscreen-change'));}

/** Fill this browser viewport while retaining body-portal menus and drag previews. */
export function SheetFullscreenButton(){
 const button=useRef<HTMLButtonElement>(null),[active,setActive]=useState(false);
 useEffect(()=>{const pane=button.current?.closest<HTMLElement>('.sheet-pane');if(!pane)return;
  const changed=()=>setActive(pane.classList.contains('sheet-fullscreen'));
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&pane.classList.contains('sheet-fullscreen'))exitSheetFullscreen();};
  window.addEventListener('sheet-fullscreen-change',changed);document.addEventListener('keydown',escape);return()=>{pane.classList.remove('sheet-fullscreen');window.removeEventListener('sheet-fullscreen-change',changed);document.removeEventListener('keydown',escape);};
 },[]);
 const toggle=()=>{const pane=button.current?.closest<HTMLElement>('.sheet-pane');if(!pane)return;
  if(pane.classList.contains('sheet-fullscreen')){exitSheetFullscreen();return;}
  pane.classList.add('sheet-fullscreen');window.dispatchEvent(new Event('sheet-fullscreen-change'));
 };
 return <button ref={button} className="sheet-fullscreen-toggle" aria-label={active?'退出卡片全屏':'卡片全屏'} aria-pressed={active} title={active?'退出卡片全屏 · Esc':'卡片全屏'} onClick={()=>void toggle()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={active?'M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6':'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6'}/></svg></button>;
}
