import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DragContext } from './DragEntry';

export const SHEET_PAGES = ['主要', '特性', '背景', '法术', '背包'] as const;
export type SheetPage = typeof SHEET_PAGES[number];
const WIDTH = 680;
const HEIGHT = WIDTH * 297 / 210;

/** A fixed A4 canvas, fitted to the viewport. Only its content regions scroll. */
export function PaperFrame({ children, page, changePage }: { children: ReactNode; page: SheetPage; changePage: (page: SheetPage) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useContext(DragContext);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { if (!drag?.entry) clearTimeout(hoverTimer.current); return () => clearTimeout(hoverTimer.current); }, [drag?.entry]);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setScale(Math.max(0.05, Math.min(width / WIDTH, (height - 38) / HEIGHT)));
    });
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);
  return <div className="sheet-viewport" ref={viewport}>
    <div className="paper-stack" style={{ width: WIDTH * scale, height: HEIGHT * scale + 38 }}>
      <div className={`paper page-${SHEET_PAGES.indexOf(page)}`} role="tabpanel" id="sheet-page" aria-labelledby={`page-tab-${page}`} style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }}>{children}</div>
      <nav className="sheet-pages" role="tablist" aria-label="角色卡页面" style={{ top: HEIGHT * scale }}>
        {SHEET_PAGES.map((name, index) => <button key={name} id={`page-tab-${name}`} role="tab" aria-selected={page === name} aria-controls="sheet-page" tabIndex={page === name ? 0 : -1} onClick={() => changePage(name)} onDragEnter={() => { if (drag?.entry && name !== page) { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => changePage(name), 400); } }} onDragLeave={() => clearTimeout(hoverTimer.current)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 5 : event.key === 'ArrowLeft' ? (index + 4) % 5 : event.key === 'Home' ? 0 : event.key === 'End' ? 4 : -1;
          if (next >= 0) { event.preventDefault(); changePage(SHEET_PAGES[next]); document.getElementById(`page-tab-${SHEET_PAGES[next]}`)?.focus(); }
        }}><span className="page-number">0{index + 1}</span>{name}</button>)}
      </nav>
    </div>
  </div>;
}
