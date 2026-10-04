import {createRoot} from 'react-dom/client';
import {DMConsole} from '../../../src/ui/WorkbenchConsole';
import '../../../src/ui/style.css';
import '../../../src/ui/workbench.css';
import '../../../src/ui/suiteTheme.css';
// Isolated host: no real room, character, persistence or remote service.
const w=window as any,root=createRoot(document.getElementById('root')!);
let sequence=0;w.requests=[];w.hold=false;
w.emit=(type:string,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'transition-rest',type,...rest}}));
w.reply=(request:any,error='')=>w.emit('ack',{requestId:request.requestId,ok:!error,...(error?{message:error}:{result:{ok:true,preview:request.preview}})});
w.refresh=(role='GM',enabled=true)=>w.emit('catalog',{sequence:++sequence,role,enabled:{transitions:enabled,inventory:false,resourceTracker:false},cards:[],monsters:[]});
w.render=(visible=true)=>root.render(visible?<DMConsole navigate={()=>{}}/>:<p>其他页面</p>);
window.addEventListener('message',event=>{const r=event.data;if(event.source!==window||r.protocol!=='full-suite-workbench/v1'||r.session!=='transition-rest')return;if(r.type==='ping'){w.emit('pong');return;}if(!r.requestId||r.type==='ack')return;w.requests.push(r);if(!w.hold)w.reply(r);});
w.emit('ready');w.refresh();w.render();
