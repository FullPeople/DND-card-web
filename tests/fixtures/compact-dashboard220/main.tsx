import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CompactResource,CompactResourceGrid} from '../../../src/ui/CompactResources';
import {ResourceRow} from '../../../src/ui/ResourceRow';
import {ResourceEditor} from '../../../src/ui/ResourceEditor';
import type {ResourceValue} from '../../../src/ui/resourcePresets';
import type {ResourceWidgetLayout,WidgetStyle} from '../../../src/core/resourceWidgets';
import '../../../src/ui/workbench.css';
import '../../../src/ui/suiteTheme.css';

const key='compact-dashboard220';
type State={resources:ResourceValue[];layouts:Record<string,ResourceWidgetLayout>};
const make=():State=>({resources:[
 {id:'ring',name:'环形行动',current:3,max:5,type:'number'},
 {id:'pips',name:'图标行动',current:2,max:4,type:'count'},
 {id:'pool',name:'子项行动',current:2,max:6,type:'number'},
 {id:'fraction',name:'无上限行动',current:12345,max:0,type:'number',unlimited:true},
],layouts:Object.fromEntries((['ring','pips','pool','fraction'] as const).map((style,i)=>[style,{style,x:0,y:0,w:4,h:2,page:0,color:['#436978','#926041','#527448','#7C5272'][i],icon:i===1?'flame':'shield'}]))});
function App(){
 const [state,setState]=useState<State>(()=>{try{return JSON.parse(localStorage.getItem(key)||'null')||make();}catch{return make();}}),[editing,setEditing]=useState(''),[pending,setPending]=useState(0);
 const save=(id:string,value:ResourceValue,style?:WidgetStyle)=>setState(before=>{const next={resources:before.resources.map(r=>r.id===id?{...value,id}:r),layouts:{...before.layouts,[id]:{...before.layouts[id],...(style?{style}:{})}}};localStorage.setItem(key,JSON.stringify(next));return next;});
 const change=async(id:string,current:number)=>{setPending(n=>n+1);await new Promise(resolve=>setTimeout(resolve,600));setState(before=>{const next={...before,resources:before.resources.map(r=>r.id===id?{...r,current}:r)};localStorage.setItem(key,JSON.stringify(next));return next;});setPending(n=>n-1);};
 return <main><h1>紧凑资源 · 实际组件</h1><p>仅原创夹具；确认延迟 600 毫秒，保存到此浏览器本地。</p><output id="pending">{pending}</output><CompactResourceGrid rows={state.resources} label="资源验证" render={r=><CompactResource resource={r} layout={state.layouts[r.id!]}><ResourceRow resource={r} confirmedCurrent={r.current} gm enabled change={n=>change(r.id!,n)} configure={()=>setEditing(r.id!)}/></CompactResource>}/>{editing&&<ResourceEditor value={state.resources.find(r=>r.id===editing)} presentation={state.layouts[editing].style} close={()=>setEditing('')} save={async(value,style)=>save(editing,value,style)}/>}<output id="fixture-data" hidden>{JSON.stringify(state)}</output></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:16px;font:14px system-ui;background:#e1e1de;color:#333}main{max-width:420px}h1{font-size:18px}p{font-size:11px}button{cursor:pointer}#pending{display:block;font-size:10px;margin:5px 0}.compact-resource-grid{gap:6px}`;document.head.append(style);
