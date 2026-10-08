import {useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {displayCharacterEdit} from '../core/displayCharacterEdit';
import {portraitFraming} from '../core/portraitFraming';
import {VisibilityEye} from './VisibilityEye';
import {portraitCoverScale} from './portraitGeometry';
import './portraitFrame.css';
import {compressPortrait} from '../platform/portrait';
import {pickFile} from '../platform/storage';
import {SheetCell} from './SheetCell';
import {SheetEditContext} from './SheetEdit';
import {storedImage} from '../core/validation';
import {useWorkbench,workbenchCharacterId} from '../platform/workbench';
type Edit=(action:(c:Character)=>void,key?:string)=>void;
export function Portrait({c,edit,field='portrait'}:{c:Character;edit:Edit;field?:'portrait'|'illustration'}){
 const target=useWorkbench().target,own=storedImage(c[field])?c[field]:undefined;
 // 没有自定义头像时用绑定的棋子图片显示；仅几何变换随角色保存，URL 不写入头像。
 const tokenUrl=own?undefined:field==='portrait'&&target?.kind==='character'&&workbenchCharacterId(target)===c.id?target.tokenPortrait?.url:undefined;
 const fallback=useMemo<Character['portrait']>(()=>tokenUrl?{data:tokenUrl,...(c.tokenPortraitTransform||{x:0,y:0,zoom:1})}:undefined,[tokenUrl,c.tokenPortraitTransform]);
 const label=field==='illustration'?'立绘':'头像',saved=own||fallback,editing=useContext(SheetEditContext),view=useRef<HTMLDivElement>(null),[moving,setMoving]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deleteConfirm,setDeleteConfirm]=useState(false);
 const frameHidden=field==='portrait'&&c.portraitFrameHidden===true;
 const image=useRef<HTMLImageElement>(null),[coverScale,setCoverScale]=useState(1);
 const [draft,setDraft]=useState(saved),latest=useRef(draft);latest.current=draft;
 useEffect(()=>{setDraft(saved);setError('');setDeleteConfirm(false);},[saved,c.id,field]);
 useEffect(()=>{if(!deleteConfirm)return;const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape')setDeleteConfirm(false);};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[deleteConfirm]);
 // The existing cover crop remains the scale/position baseline. In frameless
 // mode render the whole image with contain, then scale to that same cover size.
 // Measuring DOM size never edits the character or rewrites its stored framing.
 useLayoutEffect(()=>{
  if(!frameHidden)return;
  const element=view.current,picture=image.current;if(!element||!picture)return;
  const measure=()=>setCoverScale(portraitCoverScale(picture.naturalWidth,picture.naturalHeight,element.clientWidth,element.clientHeight));
  measure();picture.addEventListener('load',measure);
  const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>{observer.disconnect();picture.removeEventListener('load',measure);};
 },[frameHidden,draft?.data]);
 const drag=useRef<{x:number;y:number;px:number;py:number;scale:number;width:number;height:number}|undefined>(undefined);
 useEffect(()=>{const cancel=()=>{drag.current=undefined;setMoving(false);setDraft(saved);};window.addEventListener('sheet-gesture',cancel);return()=>window.removeEventListener('sheet-gesture',cancel);},[saved]);
 const position=(image:NonNullable<Character['portrait']>)=>({x:image.x/(image.frameWidth||104)*100,y:image.y/(image.frameHeight||110)*100});
 const frame=(image:NonNullable<Character['portrait']>)=>{const el=view.current!,p=position(image),clamp=(v:number)=>Math.max(-300,Math.min(300,v)),edge=(v:number)=>Math.max(1,Math.min(2000,v));return {...image,x:clamp(p.x*el.clientWidth/100),y:clamp(p.y*el.clientHeight/100),frameWidth:edge(el.clientWidth),frameHeight:edge(el.clientHeight)};};
 const saveFraming=(next:NonNullable<Character['portrait']>,key?:string)=>{if(own)edit(c=>{c[field]=next;},key);else if(field==='portrait'&&tokenUrl)edit(displayCharacterEdit('tokenPortraitTransform',portraitFraming(next)),key);};
 useEffect(()=>{const el=view.current;if(!el||!editing||!saved)return;const wheel=(e:WheelEvent)=>{if(!latest.current||!(e.target as Element).closest('.portrait-move'))return;e.preventDefault();e.stopPropagation();const next={...frame(latest.current),zoom:Math.max(1,Math.min(5,latest.current.zoom*Math.exp(-e.deltaY*.0015)))};setDraft(next);latest.current=next;saveFraming(next,`${field}-zoom`);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[editing,edit,field,!!own,!!saved,tokenUrl]);
 async function choose(){try{const file=await pickFile('image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp');if(!file)return;setBusy(true);setError('');const data=await compressPortrait(file);edit(c=>{c[field]={data,x:0,y:0,zoom:1};});}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <SheetCell label={label} className={`portrait-cell ${field==='illustration'?'illustration-cell':''} ${frameHidden?'portrait-frame-hidden':''} ${editing?'portrait-frame-editing':''}`} onHeadingClick={editing&&field==='portrait'?()=>edit(displayCharacterEdit('portraitFrameHidden',!frameHidden)):undefined} headingActionLabel="隐藏头像框" headingPressed={editing&&field==='portrait'?frameHidden:undefined} trailing={editing&&field==='portrait'?<VisibilityEye className="portrait-frame-eye" hidden={frameHidden}/>:undefined}><div ref={view} className={`portrait-view ${editing?'portrait-editing':''} ${draft?'has-portrait':''} ${moving?'portrait-moving':''}`}>
 {draft?<img ref={image} className="portrait-image" src={draft.data} alt={`角色${label}`} draggable={false} style={{transform:`translate(${position(draft).x}%,${position(draft).y}%) scale(${draft.zoom*(frameHidden?coverScale:1)})`}}/>:field==='portrait'?<svg viewBox="0 0 80 90" aria-hidden="true"><path d="M28 27L33 17H47L52 27V39L45 49H35L28 39ZM35 49V56L17 65L12 82H68L63 65L45 56V49"/></svg>:null}
 {editing&&<div className="portrait-controls">{saved&&<button className="portrait-move" aria-label={`移动${label}，滚轮缩放`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const el=view.current!,box=el.getBoundingClientRect(),normalized=frame(latest.current!);setDraft(normalized);latest.current=normalized;drag.current={x:e.clientX,y:e.clientY,px:normalized.x,py:normalized.y,scale:box.width/el.offsetWidth,width:el.clientWidth,height:el.clientHeight};setMoving(true);}} onPointerMove={e=>{const start=drag.current;if(!start||!latest.current)return;const next={...latest.current,frameWidth:start.width,frameHeight:start.height,x:Math.max(-300,Math.min(300,start.px+(e.clientX-start.x)/start.scale)),y:Math.max(-300,Math.min(300,start.py+(e.clientY-start.y)/start.scale))};latest.current=next;setDraft(next);}} onPointerUp={()=>{if(drag.current){drag.current=undefined;setMoving(false);const next=latest.current;if(next)saveFraming(next);}}} onPointerCancel={()=>{drag.current=undefined;setMoving(false);setDraft(saved);}}>✥</button>}<div className="portrait-settings-row"><button className="portrait-settings" aria-label={`设置${label}`} disabled={busy} onClick={choose}>{busy?'…':draft?'替换':'⚙'}</button>{c[field]&&<button className="portrait-delete" aria-label={`删除${label}`} disabled={busy} onClick={()=>setDeleteConfirm(true)}>删除</button>}</div></div>}
 {error&&<span className="portrait-error" role="alert">{error}</span>}
 </div>{deleteConfirm&&createPortal(<div className="portrait-confirm-shade" onPointerDown={event=>{if(event.target===event.currentTarget)setDeleteConfirm(false);}}><section role="alertdialog" aria-modal="true" aria-label={`删除${label}`} className="portrait-confirm"><strong>删除当前{label}？</strong><div><button autoFocus onClick={()=>setDeleteConfirm(false)}>取消</button><button onClick={()=>{edit(character=>{delete character[field];});setDeleteConfirm(false);}}>删除</button></div></section></div>,document.body)}</SheetCell>;
}
