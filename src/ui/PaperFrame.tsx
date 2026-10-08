import {useSheetZoom} from './useSheetZoom';
import {useUiLanguage} from './UiLanguage';
import type {UiTextKey} from './uiText';
import {useSheetRenderMode} from './sheetDisplay';
import './responsive177.css';
import { useContext, useId, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Character } from '../core/model';

import {CardIdentityContext,CardVisualContext,visualConditions,adaptiveConditionClasses} from './cardVisualState';
import { SheetEditContext } from './SheetEdit';

import { DragContext } from './DragEntry';
import {entryDragIntent,entryDragPage} from './entryDragIntent';





import {afterPaint} from '../platform/afterPaint';
export const SHEET_PAGES = ['主要', '特性', '背景', '法术', '背包'] as const;
export type SheetPage = typeof SHEET_PAGES[number];
const pageLabels:Record<SheetPage,UiTextKey>={'主要':'pageMain','特性':'pageFeatures','背景':'pageBackground','法术':'pageSpells','背包':'pageInventory'};
const WIDTH = 680;
const HEIGHT = WIDTH * 297 / 210;

/** A4 scales as a page; screen mode uses the actual pane and readable reflow. */
export function PaperFrame({ children, page, changePage, character, pages=SHEET_PAGES, effectsEnabled=true, motionEnabled=true, effectLayout }: { pages?:readonly SheetPage[]; effectsEnabled?:boolean; motionEnabled?:boolean; effectLayout?:'adaptive'; character: Character; children: ReactNode; page: SheetPage; changePage: (page: SheetPage) => void }) {
  const {t}=useUiLanguage(),instance=useId(),panelId=`sheet-page-${instance}`,tabId=(name:string)=>`page-tab-${instance}-${name}`;
  const editing = useContext(SheetEditContext);
  const mode=useSheetRenderMode(),compact=mode==='screen';
  const [scale, setFit] = useState(0.5);
  const adaptive=effectsEnabled&&(compact||effectLayout==='adaptive');
  const effects = visualConditions(character);
  const visuals = editing || !effectsEnabled ? { active: new Set<import('./conditionVisuals').ConditionVisual>(), exhaustion: 0 } : effects;
  const originalVisuals=adaptive?{active:new Set<import('./conditionVisuals').ConditionVisual>(),exhaustion:0}:visuals;
  const paper=useRef<HTMLDivElement>(null);
  const [decoration,setDecoration]=useState<typeof import('./CardDecoration')>();
  useEffect(()=>{if(!effectsEnabled||!motionEnabled)return;return afterPaint(()=>{void import('./CardDecoration').then(setDecoration).catch(error=>console.warn('Card decoration unavailable:',error));});},[effectsEnabled,motionEnabled]);
  const viewport = useRef<HTMLDivElement>(null);
  const {view:zoom,reset:resetZoom}=useSheetZoom(viewport,`${character.id}:${mode}`,!compact);
  const drag = useContext(DragContext);
  useEffect(()=>{const lift=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.preservePage)return;const entry=detail?.entry;const next=entry&&entryDragPage(entry,detail.intent||entryDragIntent(entry));if(next&&pages.includes(next)&&next!==page)changePage(next);};window.addEventListener('entry-drag-start',lift);return()=>window.removeEventListener('entry-drag-start',lift);},[page,pages,changePage]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { if (!drag?.preservePage && drag?.entry && drag.hoverTab && drag.hoverTab !== page) hoverTimer.current = setTimeout(() => changePage(drag.hoverTab as SheetPage), 400); return () => clearTimeout(hoverTimer.current); }, [drag?.entry, drag?.hoverTab,drag?.preservePage, page]);
  useLayoutEffect(()=>{if(compact&&viewport.current)viewport.current.scrollTop=0;},[page,character.id,compact]);
  useLayoutEffect(() => {
    const node=viewport.current!;
    const fit=(width:number,height:number)=>{if(!width||!height)return;setFit(Math.max(.05,Math.min((width-42)/WIDTH,height/HEIGHT)));};
    const css=getComputedStyle(node);fit(node.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),node.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom));
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width,entry.contentRect.height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact]);
  return <CardIdentityContext.Provider value={character.id}><CardVisualContext.Provider value={originalVisuals}><div className={`sheet-viewport ${compact?'screen-mode':'a4-mode'}`} data-sheet-display={mode} ref={viewport}>
    <div className="paper-stack" style={{ width:compact?'100%':WIDTH*scale+42,height:compact?'auto':HEIGHT*scale,transform:`translate(${zoom.x}px,${zoom.y}px) scale(${zoom.zoom})` }}>
      <div ref={paper} data-visual-editing={editing} className={`paper has-card-art ${editing ? 'visual-editing' : ''} ${adaptive?adaptiveConditionClasses(visuals.active,editing):[...visuals.active].map(id => `condition-${id}`).join(' ')} page-${SHEET_PAGES.indexOf(page)}`} role="tabpanel" id={panelId} aria-labelledby={tabId(page)} style={{ ...Object.fromEntries(Object.entries(character.palette||{}).map(([key,value])=>[`--paper-${key}`,value])),width:compact?'100%':WIDTH,height:compact?'auto':HEIGHT,top:0,transform:compact?'none':`scale(${scale})` } as CSSProperties}>{effectsEnabled&&motionEnabled&&decoration&&<decoration.CardDecoration character={character} paper={paper} adaptive={adaptive} editing={editing} page={page} compact={compact}/>}{children}</div>
      <nav className="sheet-pages" role="tablist" aria-label={t('sheetPages')} style={{ left: compact?0:WIDTH * scale, top: compact?0:25 }} aria-orientation={compact?'horizontal':'vertical'}>
        {pages.map((name, index) => <button key={name} id={tabId(name)} role="tab" aria-selected={page === name} aria-controls={panelId} tabIndex={page === name ? 0 : -1} onClick={() => changePage(name)} data-sheet-tab={name} onKeyDown={event => {
          const next = ['ArrowRight','ArrowDown'].includes(event.key) ? (index + 1) % pages.length : ['ArrowLeft','ArrowUp'].includes(event.key) ? (index + pages.length-1) % pages.length : event.key === 'Home' ? 0 : event.key === 'End' ? pages.length-1 : -1;
          if (next >= 0) { event.preventDefault(); changePage(pages[next]); document.getElementById(tabId(pages[next]))?.focus(); }
        }}><span className="page-number" aria-hidden="true">0{index + 1}</span>{t(pageLabels[name])}</button>)}
      </nav>
    </div>
    {zoom.zoom>1.01&&<button className="sheet-zoom-reset" onClick={resetZoom} aria-label={t('resetZoom')}>{Math.round(zoom.zoom*100)}% · {t('reset')}</button>}
  </div></CardVisualContext.Provider></CardIdentityContext.Provider>;
}
