import {useEffect,useRef,useState} from 'react';
import {useUiLanguage} from './UiLanguage';
import {CollapseIcon,ExpandIcon} from './icons';

export function exitSheetFullscreen(){document.querySelectorAll('.sheet-pane.sheet-fullscreen').forEach(pane=>pane.classList.remove('sheet-fullscreen'));window.dispatchEvent(new Event('sheet-fullscreen-change'));}

/** Fill this browser viewport while retaining body-portal menus and drag previews. */
export function SheetFullscreenButton(){
 const {t}=useUiLanguage();
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
 return <button ref={button} className="sheet-fullscreen-toggle" aria-label={t(active?'exitFullscreen':'fullscreen')} aria-pressed={active} title={t(active?'exitFullscreen':'fullscreen')+(active?' · Esc':'')} onClick={()=>void toggle()}>{active?<CollapseIcon/>:<ExpandIcon/>}</button>;
}
