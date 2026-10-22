import {memo,useEffect,useLayoutEffect,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {Character,Derived,Entry} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {sheetChoices,type SheetChoice} from '../src/core/automation/choices';
import {Overview} from '../src/ui/Overview';
import {PaperFrame} from '../src/ui/PaperFrame';
import {SheetChoicesContext} from '../src/ui/SheetChoicesContext';
import {SheetEditContext} from '../src/ui/SheetEdit';
import {UiLanguageProvider} from '../src/ui/UiLanguage';
import {setSheetDisplayMode} from './sheetDisplay';
import {counts,type CardRenderer,type RendererOptions} from './types';
import '../src/ui/style.css';
import '../src/ui/workspace.css';
import '../src/ui/overview.css';
import '../src/ui/library.css';
import '../src/ui/cardAtmosphere.css';
import '../src/ui/libraryRefine.css';
import '../src/ui/characterPages.css';
import '../src/ui/suiteTheme.css';
import '../src/ui/responsive176.css';
import '../src/ui/refinement183.css';
import '../src/ui/domesticCompact.css';
import '../src/ui/screenLayout.css';
import '../src/ui/appearance.css';

type Prepared={c:Character;d:Derived;entries:Entry[];choices:SheetChoice[]};
const noop=()=>{};
function prepare(c:Character):Prepared{
 const entries=[...new Map(c.selections.map(row=>[row.entry.id,row.entry])).values()];
 counts.evaluations++;const d=evaluate(c);counts.choices++;return {c,d,entries,choices:sheetChoices(c,entries)};
}
function Mounted({children}:{children:ReactNode}){useEffect(()=>{counts.mounts++;return()=>{counts.unmounts++;};},[]);return children;}
function CardBody({view,decoration}:{view:Prepared;decoration:boolean}){
 useLayoutEffect(()=>{counts.commits++;});
 const {c,d,entries,choices}=view;
 return <Mounted><UiLanguageProvider><SheetChoicesContext.Provider value={{character:c,catalog:entries,choices}}><SheetEditContext.Provider value={false}>
  <PaperFrame character={c} page="主要" changePage={noop} effectsEnabled={decoration} motionEnabled={decoration}>
   <header className="paper-heading"><strong>{c.name}</strong><span>{c.edition}</span></header>
   <Overview c={c} d={d} catalog={entries} edit={noop} browse={noop} inspect={noop} onLink={noop} addEntry={noop} renderSelection={()=>null} statusRibbon={<div className="edition-divider"><span/><strong>{c.edition} · 切卡实验</strong><span/></div>} openResources={noop} openQuickbar={noop} pinDrop={noop}/>
  </PaperFrame>
 </SheetEditContext.Provider></SheetChoicesContext.Provider></UiLanguageProvider></Mounted>;
}
const RetainedCard=memo(CardBody);
export async function mount({host,cards,mode,decoration,display}:RendererOptions):Promise<CardRenderer>{
 setSheetDisplayMode(display);
 if(decoration)await import('../src/ui/CardDecoration');
 const prepared=new Map<Character,Prepared>();
 if(mode==='cached'||mode==='retained')for(const card of cards)prepared.set(card,prepare(card));
 const root=createRoot(host);
 if(mode==='retained')flushSync(()=>root.render(<>{cards.map((card,index)=><div className="lab-deck-panel" data-deck-card={index} key={card.id}><RetainedCard view={prepared.get(card)!} decoration={decoration}/></div>)}</>));
 return {
  show(index){
   if(mode==='retained')for(const panel of host.querySelectorAll<HTMLElement>('[data-deck-card]')){const visible=Number(panel.dataset.deckCard)===index;panel.classList.toggle('is-active',visible);panel.setAttribute('aria-hidden',String(!visible));panel.inert=!visible;}
   else{const card=cards[index],view=mode==='cached'?prepared.get(card)!:prepare(card);flushSync(()=>root.render(<CardBody view={view} decoration={decoration}/>));}
  },
  dispose(){root.unmount();},
 };
}
