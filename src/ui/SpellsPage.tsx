import {ShareEntryButton} from './EntrySharing';
import {NumberInput} from './NumberInput';
import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal,flushSync} from 'react-dom';
import {type Selection} from '../core/model';
import {spellState} from '../core/characterDetails';
import {prepareSpellEntry,setPreparedSpell,spellLibrary} from '../core/spells';
import {casterProfiles,spellUsesPreparation} from '../core/spellcastingRules';
import {removeSelection} from '../core/sheet';
import {SheetCell} from './SheetCell';
import {SheetEditContext} from './SheetEdit';
import {Reference,ReferenceContext} from './Reference';
import {pointerDrag} from './pointerDrag';
import {captureSpellReflow,liftSpellTile} from './spellFlight';
import {type PageProps} from './CharacterPages';
import './spellsPage.css';

function SpellFrame(){return <svg className="spell-tile-frame" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="M3 .75H97L99.25 3V25L97 27.25H3L.75 25V3Z"/></svg>;}
function ConcentrationMark(){return <svg className="spell-concentration-mark" viewBox="0 0 24 24" role="img" aria-label="专注"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7"/><path d="m12 4 7 12H5Zm0 16L5 8h14Z"/><path d="M12 0v3m0 18v3M0 12h3m18 0h3"/></svg>;}
export function SpellsPage({c,edit,browse,add,entries=[],inspect}:PageProps){
 const editing=useContext(SheetEditContext),preview=useContext(ReferenceContext),settings=spellState(c);
 const spells=useMemo(()=>spellLibrary(c,entries),[c,entries]),[focused,setFocused]=useState<number>();
 const [menu,setMenu]=useState<{row:Selection;x:number;y:number}>();
 const preparedRoot=useRef<HTMLDivElement>(null),libraryRoot=useRef<HTMLDivElement>(null);
 const change=(fn:(s:ReturnType<typeof spellState>)=>void)=>edit(c=>{c.spellSettings=structuredClone(settings);fn(c.spellSettings);});
 const prepared=settings.prepared.map(id=>spells.some(s=>s.id===id)?id:''),count=prepared.filter(Boolean).length;
 const library=spells.filter(s=>settings.mode!=='prepared'||!prepared.includes(s.id));
 const fullList=casterProfiles(c).some(p=>p.mode==='prepared'&&p.pool==='list');
 useEffect(()=>{if(!menu)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(undefined);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[menu]);
 function move(row:Selection,prepare:boolean,source?:HTMLElement,index?:number){
  const land=source?liftSpellTile(source):undefined,settle=captureSpellReflow(libraryRoot.current);let changed=false,resultId=row.id;
  flushSync(()=>edit(draft=>{
   if(prepare){const result=prepareSpellEntry(draft,row.entry,index??focused);changed=!!result;if(result)resultId=result;}
   else changed=setPreparedSpell(draft,row.id,false);
  }));settle();setFocused(undefined);
  const target=(prepare?preparedRoot:libraryRoot).current?.querySelector<HTMLElement>(`[data-spell-id="${CSS.escape(resultId)}"]`);
  land?.(changed?target:undefined);if(prepare&&!changed&&!settings.prepared.includes(row.id))window.dispatchEvent(new CustomEvent('workbench-error',{detail:'已达到预备法术上限'}));return resultId;
 }
 function tile(row:Selection,preparedTile=false){
  const canPrepare=settings.mode==='prepared'&&spellUsesPreparation(c,row.entry),stored=c.selections.some(s=>s.id===row.id),level=Number(row.entry.raw.level)||0;
  return <Reference key={row.id} reference={`entry:${row.entry.id}`} entry={row.entry} commitOnClick={false}
   className={`stock-item spell-stock-tile ${preparedTile?'prepared-slot':'spell-choice'} ${row.entry.raw.meta?.ritual?'spell-ritual':''} ${row.entry.raw.duration?.some((v:any)=>v.concentration)?'spell-concentration':''}`}
   data-spell-id={row.id} data-entry-context-menu data-physical-frame="" aria-label={preparedTile?`取消预备${row.entry.name}`:row.entry.name}
   onClick={e=>{if(canPrepare)move(row,!preparedTile,e.currentTarget);else inspect(row.entry);}}
   onContextMenu={e=>{e.preventDefault();e.stopPropagation();preview?.close();setMenu({row,x:Math.max(8,Math.min(innerWidth-190,e.clientX)),y:Math.max(8,Math.min(innerHeight-150,e.clientY))});}}
   onPointerDown={e=>{
    if(e.button!==0||(!canPrepare&&(!editing||!stored)))return;
    const source=e.currentTarget,preparedZone=preparedRoot.current?.closest('.prepared-cell'),libraryZone=libraryRoot.current?.closest('.spell-library');
    const clear=()=>{preparedZone?.classList.remove('spell-drop-over');libraryZone?.classList.remove('spell-drop-over');};
    const inPrepared=(hit:Element|null)=>!!hit&&!!preparedZone?.contains(hit);
    const inLibrary=(hit:Element|null)=>!!hit&&!!libraryZone?.contains(hit);
    pointerDrag(e,{appearance:'source',title:row.entry.name,cancel:clear,
     outside:hit=>!inPrepared(hit)&&!inLibrary(hit)&&(preparedTile||editing&&stored),
     move:(_,hit)=>{preparedZone?.classList.toggle('spell-drop-over',canPrepare&&inPrepared(hit));libraryZone?.classList.toggle('spell-drop-over',preparedTile&&inLibrary(hit));},
     finish:(_,hit)=>{
      clear();
      if(canPrepare&&inPrepared(hit)){
       const index=hit?.closest<HTMLElement>('[data-prepared-slot]')?.dataset.preparedSlot;let id=row.id;
       const settle=captureSpellReflow(libraryRoot.current);
       edit(draft=>{const next=prepareSpellEntry(draft,row.entry,index===undefined?focused:Number(index));id=next||row.id;if(!next&&!settings.prepared.includes(row.id))window.dispatchEvent(new CustomEvent('workbench-error',{detail:'已达到预备法术上限'}));});setFocused(undefined);
       return {resolve:()=>{settle();return preparedRoot.current?.querySelector<HTMLElement>(`[data-spell-id="${CSS.escape(id)}"]`)||source;}};
      }
      if(preparedTile&&!inPrepared(hit)){
       const settle=captureSpellReflow(libraryRoot.current);
       edit(draft=>{setPreparedSpell(draft,row.id,false);});
       return {resolve:()=>{settle();return libraryRoot.current?.querySelector<HTMLElement>(`[data-spell-id="${CSS.escape(row.id)}"]`)||null;}};
      }
      if(editing&&stored&&!inLibrary(hit)){edit(draft=>removeSelection(draft,row.id));return {removed:true};}
     }
    });
   }}><SpellFrame/><span className="stock-name">{row.entry.name}</span><span className="spell-stock-meta">{row.entry.raw.duration?.some((v:any)=>v.concentration)&&<ConcentrationMark/>}<span className="spell-stock-level" aria-label={level===0?'戏法':`${level}环`} title={level===0?'戏法':`${level}环法术`}>{level}</span></span></Reference>;
 }
 return <>{editing&&<div className="spell-settings"><div className="segmented"><button aria-pressed={!settings.modeOverride} onClick={()=>change(s=>{s.modeOverride=false;})}>跟随职业</button>{(['known','prepared'] as const).map(mode=><button key={mode} aria-pressed={!!settings.modeOverride&&settings.mode===mode} onClick={()=>change(s=>{s.mode=mode;s.modeOverride=true;})}>{mode==='known'?'学习法术制':'预备法术制'}</button>)}</div>{settings.mode==='prepared'&&<label>预备上限调整<NumberInput aria-label="预备上限调整" type="number" min="-100" max="100" value={settings.capacityAdjustment||0} onChange={e=>change(s=>{s.capacityAdjustment=Math.max(-100,Math.min(100,Math.trunc(Number(e.target.value)||0)));})}/></label>}</div>}
 {settings.mode==='prepared'&&<SheetCell label={`预备法术 ${count}${settings.capacity?` / ${settings.capacity}`:''}`} className="prepared-cell spell-stock-cell" trailing={<small className="spell-prepare-hint">左键或拖拽加入 / 移除</small>}><div ref={preparedRoot} className="prepared-slots spell-stock-grid">{Array.from({length:Math.max(settings.capacity||Math.max(5,count+1),prepared.length)},(_,i)=>{const row=spells.find(s=>s.id===prepared[i]);return row?<div key={i} className="spell-grid-slot" data-prepared-slot={i}>{tile(row,true)}</div>:<button key={i} data-prepared-slot={i} data-physical-frame="" className={`stock-empty prepared-slot spell-stock-empty ${focused===i?'slot-focused':''}`} aria-label={`预备空位${i+1}`} onClick={()=>setFocused(i)}><SpellFrame/>＋</button>;})}</div></SheetCell>}
 <SheetCell label={fullList&&settings.mode==='prepared'?'职业法术表':'已学法术'} className="spell-library spell-stock-cell" dropKinds={['spell']} onReceive={add}><div ref={libraryRoot} className="spell-library-groups">{[...new Set(library.map(s=>Number(s.entry.raw.level)||0))].sort((a,b)=>a-b).map(level=><section key={level} data-spell-level={level} className="spell-library-level"><h4>{level===0?'戏法':`${level}环`}</h4><div className="spell-stock-grid">{library.filter(s=>(Number(s.entry.raw.level)||0)===level).map(s=>tile(s))}</div></section>)}</div><button className="feature-browse" onClick={()=>browse('spell')}>＋ 查阅法术</button></SheetCell>
 {menu&&createPortal(<div className="stock-menu-shade spell-menu-shade" onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();setMenu(undefined);}}} onContextMenu={e=>{e.preventDefault();setMenu(undefined);}}><div role="menu" aria-label="法术操作" className="stock-menu spell-context-menu" style={{left:menu.x,top:menu.y}}><strong>{menu.row.entry.name}</strong><ShareEntryButton entry={menu.row.entry} done={()=>setMenu(undefined)}/>{settings.mode==='prepared'&&spellUsesPreparation(c,menu.row.entry)&&<button role="menuitem" onClick={()=>{move(menu.row,!prepared.includes(menu.row.id));setMenu(undefined);}}>{prepared.includes(menu.row.id)?'取消预备':'预备法术'}</button>}<button role="menuitem" onClick={()=>{inspect(menu.row.entry);setMenu(undefined);}}>在 Wiki 中查看</button>{editing&&c.selections.some(s=>s.id===menu.row.id)&&<button role="menuitem" onClick={()=>{edit(draft=>removeSelection(draft,menu.row.id));setMenu(undefined);}}>从角色卡移除</button>}</div></div>,document.body)}</>;
}
