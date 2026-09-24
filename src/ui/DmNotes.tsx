import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {bbUrl,parseBbcode,type BbNode} from '../core/bbcode';
import {useWorkbench} from '../platform/workbench';
import {getNotesController} from '../platform/notes';
import './dmNotes.css';

function render(nodes:BbNode[]):ReactNode{return nodes.map((node,index)=>{if(typeof node==='string')return node;const content=render(node.children),props={key:index};switch(node.tag){
 case 'b':return <strong {...props}>{content}</strong>;case 'i':return <em {...props}>{content}</em>;case 'u':return <u {...props}>{content}</u>;case 's':return <s {...props}>{content}</s>;
 case 'h1':return <h1 {...props}>{content}</h1>;case 'h2':return <h2 {...props}>{content}</h2>;case 'h3':return <h3 {...props}>{content}</h3>;
 case 'quote':return <blockquote {...props}>{content}</blockquote>;case 'code':return <pre {...props}><code>{content}</code></pre>;
 case 'list':return node.value?<ol {...props}>{content}</ol>:<ul {...props}>{content}</ul>;case '*':return <li {...props}>{content}</li>;
 case 'br':return <br {...props}/>;case 'center':return <div {...props} style={{textAlign:'center'}}>{content}</div>;
 case 'color':return <span {...props} style={{color:/^(#[\da-f]{3,8}|[a-z]{3,20})$/i.test(node.value||'')?node.value:undefined}}>{content}</span>;
 case 'size':return <span {...props} style={{fontSize:Math.max(10,Math.min(40,Number(node.value)||14))}}>{content}</span>;
 case 'url':{const href=bbUrl(node.value||node.children.filter(v=>typeof v==='string').join(''));return href?<a {...props} href={href} target="_blank" rel="noopener noreferrer">{content}</a>:<span {...props}>{content}</span>;}
 default:return <span {...props}>{content}</span>;
}});}
export function DmNotes(){
 const wb=useWorkbench(),controller=getNotesController(),{text,loaded,status,error}=useSyncExternalStore(controller.subscribe,controller.getSnapshot),[mode,setMode]=useState<'edit'|'preview'|'both'>('both');
 const area=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>()=>{void controller.flush();},[controller]);
 useEffect(()=>{if(wb.role==='GM'&&wb.online)void controller.load();},[controller,wb.online,wb.role]);
 const change=controller.change;
 const format=(tag:string)=>{const el=area.current;if(!el)return;const a=el.selectionStart,b=el.selectionEnd,open=`[${tag}]`,close=`[/${tag.split('=')[0]}]`;change(text.slice(0,a)+open+text.slice(a,b)+close+text.slice(b));requestAnimationFrame(()=>{el.focus();el.setSelectionRange(a+open.length,b+open.length);});};
 const preview=useMemo(()=>render(parseBbcode(text)),[text]);
 if(wb.role!=='GM')return null;
 return <section className="dm-notes" aria-label="DM 笔记"><header><strong>笔记</strong><small role="status">{status}</small><div className="segmented">{(['edit','both','preview'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{({edit:'编辑',both:'并排',preview:'阅读'})[value]}</button>)}</div></header>{error&&<div className="notes-error" role="alert">{error}<button onClick={()=>void controller.retry()}>重试保存</button><button onClick={()=>void controller.replaceFromRemote()}>载入远端</button></div>}
 {mode!=='preview'&&<div className="notes-format">{[['b','粗体'],['i','斜体'],['u','下划线'],['h2','标题'],['quote','引用'],['code','代码'],['list','列表'],['url=https://','链接'],['color=#b53a3a','颜色']].map(([tag,label])=><button key={tag} disabled={!loaded} onClick={()=>format(tag)}>{label}</button>)}</div>}
 <div className={`notes-pages notes-${mode}`}>{mode!=='preview'&&<textarea ref={area} aria-label="笔记 BBCode" spellCheck={false} maxLength={500000} disabled={!loaded} value={text} onChange={e=>change(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();void controller.flush();}}}/>}{mode!=='edit'&&<article className="notes-preview">{preview}</article>}</div></section>;
}
