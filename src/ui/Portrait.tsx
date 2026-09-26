import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {compressPortrait} from '../platform/portrait';
import {pickFile} from '../platform/storage';
import {SheetCell} from './SheetCell';
import {SheetEditContext} from './SheetEdit';
import {storedImage} from '../core/validation';
import {useWorkbench,workbenchCharacterId} from '../platform/workbench';
type Edit=(action:(c:Character)=>void,key?:string)=>void;
export function Portrait({c,edit,field='portrait'}:{c:Character;edit:Edit;field?:'portrait'|'illustration'}){
 const target=useWorkbench().target,own=storedImage(c[field])?c[field]:undefined;
 // 没有自定义头像时用绑定的棋子图片显示。它是引用而不是角色数据，任何操作都不得写回角色。
 const tokenUrl=own?undefined:field==='portrait'&&target?.kind==='character'&&workbenchCharacterId(target)===c.id?target.tokenPortrait?.url:undefined;
 const fallback=useMemo<Character['portrait']>(()=>tokenUrl?{data:tokenUrl,x:0,y:0,zoom:1}:undefined,[tokenUrl]);
 const label=field==='illustration'?'立绘':'头像',saved=own||fallback,editing=useContext(SheetEditContext),view=useRef<HTMLDivElement>(null),[moving,setMoving]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deleteConfirm,setDeleteConfirm]=useState(false);
 const [draft,setDraft]=useState(saved),latest=useRef(draft);latest.current=draft;
 useEffect(()=>{setDraft(saved);setError('');setDeleteConfirm(false);},[saved,c.id,field]);
 useEffect(()=>{if(!deleteConfirm)return;const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape')setDeleteConfirm(false);};window.addEventListener('keydown',cancel);return()=>window.removeEventListener('keydown',cancel);},[deleteConfirm]);
 const drag=useRef<{x:number;y:number;px:number;py:number;scale:number;width:number;height:number}|undefined>(undefined);
 useEffect(()=>{const cancel=()=>{drag.current=undefined;setMoving(false);setDraft(saved);};window.addEventListener('sheet-gesture',cancel);return()=>window.removeEventListener('sheet-gesture',cancel);},[saved]);
 const position=(image:NonNullable<Character['portrait']>)=>({x:image.x/(image.frameWidth||104)*100,y:image.y/(image.frameHeight||110)*100});
 const frame=(image:NonNullable<Character['portrait']>)=>{const el=view.current!,p=position(image),clamp=(v:number)=>Math.max(-300,Math.min(300,v)),edge=(v:number)=>Math.max(1,Math.min(2000,v));return {...image,x:clamp(p.x*el.clientWidth/100),y:clamp(p.y*el.clientHeight/100),frameWidth:edge(el.clientWidth),frameHeight:edge(el.clientHeight)};};
 useEffect(()=>{const el=view.current;if(!el||!editing||!own)return;const wheel=(e:WheelEvent)=>{if(!latest.current||!(e.target as Element).closest('.portrait-move'))return;e.preventDefault();e.stopPropagation();const next={...frame(latest.current),zoom:Math.max(1,Math.min(5,latest.current.zoom*Math.exp(-e.deltaY*.0015)))};setDraft(next);edit(c=>{c[field]=next;},`${field}-zoom`);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[editing,edit,field,!!own]);
 async function choose(){try{const file=await pickFile('image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp');if(!file)return;setBusy(true);setError('');const data=await compressPortrait(file);edit(c=>{c[field]={data,x:0,y:0,zoom:1};});}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <SheetCell label={label} className={`portrait-cell ${field==='illustration'?'illustration-cell':''}`}><div ref={view} className={`portrait-view ${editing?'portrait-editing':''} ${draft?'has-portrait':''} ${moving?'portrait-moving':''}`}>
 {draft?<img className="portrait-image" src={draft.data} alt={`角色${label}`} draggable={false} style={{transform:`translate(${position(draft).x}%,${position(draft).y}%) scale(${draft.zoom})`}}/>:field==='portrait'?<svg viewBox="0 0 80 90" aria-hidden="true"><path d="M28 27L33 17H47L52 27V39L45 49H35L28 39ZM35 49V56L17 65L12 82H68L63 65L45 56V49"/></svg>:null}
 {editing&&<div className="portrait-controls">{own&&<button className="portrait-move" aria-label={`移动${label}，滚轮缩放`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const el=view.current!,box=el.getBoundingClientRect(),normalized=frame(latest.current!);setDraft(normalized);latest.current=normalized;drag.current={x:e.clientX,y:e.clientY,px:normalized.x,py:normalized.y,scale:box.width/el.offsetWidth,width:el.clientWidth,height:el.clientHeight};setMoving(true);}} onPointerMove={e=>{const start=drag.current;if(!start||!latest.current)return;setDraft({...latest.current,frameWidth:start.width,frameHeight:start.height,x:Math.max(-300,Math.min(300,start.px+(e.clientX-start.x)/start.scale)),y:Math.max(-300,Math.min(300,start.py+(e.clientY-start.y)/start.scale))});}} onPointerUp={()=>{if(drag.current){drag.current=undefined;setMoving(false);const next=latest.current;edit(c=>{c[field]=next;});}}} onPointerCancel={()=>{drag.current=undefined;setMoving(false);setDraft(saved);}}>✥</button>}<div className="portrait-settings-row"><button className="portrait-settings" aria-label={`设置${label}`} disabled={busy} onClick={choose}>{busy?'…':draft?'替换':'⚙'}</button>{c[field]&&<button className="portrait-delete" aria-label={`删除${label}`} disabled={busy} onClick={()=>setDeleteConfirm(true)}>删除</button>}</div></div>}
 {error&&<span className="portrait-error" role="alert">{error}</span>}
 </div>{deleteConfirm&&createPortal(<div className="portrait-confirm-shade" onPointerDown={event=>{if(event.target===event.currentTarget)setDeleteConfirm(false);}}><section role="alertdialog" aria-modal="true" aria-label={`删除${label}`} className="portrait-confirm"><strong>删除当前{label}？</strong><div><button autoFocus onClick={()=>setDeleteConfirm(false)}>取消</button><button onClick={()=>{edit(character=>{delete character[field];});setDeleteConfirm(false);}}>删除</button></div></section></div>,document.body)}</SheetCell>;
}

const colors={paper:'#ededeb',surface:'#e8e8e8',frame:'#595959',heading:'#7c7c7c',ink:'#343532',badge:'#555555'};
type PaletteKey=keyof typeof colors;
function PaletteColor({colorKey,label,value,edit}:{colorKey:PaletteKey;label:string;value:string;edit:Edit}){
 const input=useRef<HTMLInputElement>(null),frame=useRef(0),pending=useRef<string|undefined>(undefined);
 const latest=useRef({value,edit});latest.current={value,edit};
 function preview(){frame.current=0;const el=input.current;if(el&&pending.current)el.closest<HTMLElement>('.paper')?.style.setProperty(`--paper-${colorKey}`,pending.current);}
 function commit(){cancelAnimationFrame(frame.current);preview();const next=pending.current;pending.current=undefined;if(next&&next!==latest.current.value)latest.current.edit(c=>{(c.palette||={})[colorKey]=next;},`color-${colorKey}`);}
 useEffect(()=>{if(input.current)input.current.value=value;},[value]);
 useEffect(()=>{const el=input.current!;el.addEventListener('change',commit);el.addEventListener('blur',commit);return()=>{cancelAnimationFrame(frame.current);el.removeEventListener('change',commit);el.removeEventListener('blur',commit);};},[colorKey]);
 return <label title={label}><input ref={input} type="color" aria-label={label} defaultValue={value} onInput={e=>{pending.current=e.currentTarget.value;if(!frame.current)frame.current=requestAnimationFrame(preview);}}/></label>;
}
export function Palette({c,edit}:{c:Character;edit:Edit}){return <div className="palette-controls">{Object.entries({paper:'纸张色调',surface:'内容底色',frame:'框默认色',heading:'标题颜色',ink:'文字颜色',badge:'职业图标颜色'}).map(([key,label])=><PaletteColor key={`${c.id}:${key}`} colorKey={key as PaletteKey} label={label} value={c.palette?.[key as PaletteKey]||colors[key as PaletteKey]} edit={edit}/>)}</div>;}
