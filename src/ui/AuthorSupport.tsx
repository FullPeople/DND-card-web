import {useRef,useState} from 'react';
import {FEEDBACK_EMAIL} from './UiControls';
import './authorSupport.css';
function SupportQr({kind,label}:{kind:string;label:string}){
 const ref=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),[pinned,setPinned]=useState(false);
 const show=(anchor:HTMLElement)=>{clearTimeout(timer.current);const node=ref.current;if(!node)return;node.showPopover();const b=anchor.getBoundingClientRect();node.style.left=`${Math.max(8,Math.min(innerWidth-node.offsetWidth-8,b.left))}px`;node.style.top=`${Math.max(8,Math.min(innerHeight-node.offsetHeight-8,b.bottom+6))}px`;};
 const hide=()=>{if(!pinned)timer.current=setTimeout(()=>ref.current?.hidePopover(),120);};
 return <><button type="button" className="author-support-qr" aria-label={`放大${label}赞助二维码`} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={hide} onFocus={e=>show(e.currentTarget)} onBlur={hide} onClick={e=>{setPinned(true);show(e.currentTarget);}}><img src={`./support/${kind}`} alt={label}/></button>{(<div ref={ref} popover="auto" className="author-qr-preview" onMouseEnter={()=>clearTimeout(timer.current)} onMouseLeave={hide} onToggle={e=>{if((e.nativeEvent as ToggleEvent).newState==='closed')setPinned(false);}}><header><strong>{label}</strong><button type="button" aria-label="关闭二维码" onClick={()=>{setPinned(false);ref.current?.hidePopover();}}>×</button></header><img src={`./support/${kind}`} alt={`${label}赞助二维码`}/></div>)}</>;
}
export function AuthorSupport(){return <section className="author-support"><p>这套插件由 <strong>弗人 FullPeople</strong> 利用业余时间开发，当前版本附带对应源码。如果这个插件真的让你感到惊喜，欢迎以下方式支持作者： <span className="author-support-inline"><a href="https://ko-fi.com/fullpeople" target="_blank" rel="noopener noreferrer">Ko-fi</a><SupportQr kind="wechat.png" label="微信"/><SupportQr kind="alipay.jpg" label="支付宝"/></span></p><p>赞助过的朋友请把你们的 cn + 头像/立绘发送到我的邮箱 <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>，会更新到弹幕之中！</p></section>;}
