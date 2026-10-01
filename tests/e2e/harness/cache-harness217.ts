import React,{useContext,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useLibrary} from '../../../src/ui/useLibrary';
import {useAdaptiveCardGravity} from '../../../src/ui/useAdaptiveCardGravity';
import {KeywordPreview} from '../../../src/ui/KeywordPreview';
import {ReferenceContext} from '../../../src/ui/Reference';
import type {Entry} from '../../../src/core/model';
const entry=(id:string,name:string):Entry=>({id,name,english:name,kind:'feature',source:'TEST',edition:'both',packId:'fixture',revision:'1',entries:['Body '+name],raw:{}});
const shared=entry('public','Public'),privateEntry=entry('private','Private'),publicEntries=[shared];
function LibraryHarness(){const [selected,setSelected]=useState([privateEntry]);const library=useLibrary(publicEntries,selected,true);(window as any).harness={library,shared,privateEntry,revoke:()=>setSelected([]),restore:()=>setSelected([privateEntry])};return React.createElement('div',{id:'detail'},library.detail?.name||'empty');}
function GravityHarness(){const [options,setOptions]=useState({enabled:false,editing:false,identity:'a',extra:0});const root=useRef<HTMLDivElement>(null);useAdaptiveCardGravity(root,options.enabled,options.identity,String(options.extra),options.editing);(window as any).harness={set:(patch:any)=>setOptions(value=>({...value,...patch}))};return React.createElement('div',{id:'gravity-root',ref:root,style:{width:300,height:260,position:'relative',overflow:'hidden'}},[0,1,2,...Array.from({length:options.extra},(_,i)=>i+3)].map(i=>React.createElement('div',{key:options.identity+':'+i,'data-adaptive-physical':'',style:{position:'absolute',top:i*55,left:10,width:220,height:35,transition:'opacity 1s',filter:'blur(0px)'},'data-fixture-index':i},'Cell '+i)));}
function PreviewAnchor({entry}:{entry:Entry}){const context=useContext(ReferenceContext);return React.createElement('button',{onMouseEnter:(e:React.MouseEvent<HTMLButtonElement>)=>context!.show(e.currentTarget,entry.name,entry.kind,undefined,entry)},entry.name);}
function PreviewHarness(){const [allowed,setAllowed]=useState(true);(window as any).harness={revoke:()=>setAllowed(false)};return React.createElement(KeywordPreview,{children:[shared,privateEntry].map(entry=>React.createElement(PreviewAnchor,{key:entry.id,entry})),resolve:(name:string)=>[shared,privateEntry].find(e=>e.name===name),open:()=>{},wikiVisible:()=>false,readableEntry:entry=>entry.id===shared.id?shared:allowed&&entry.id===privateEntry.id?privateEntry:undefined});}
createRoot(document.getElementById('root')!).render(React.createElement(new URLSearchParams(location.search).has('gravity')?GravityHarness:new URLSearchParams(location.search).has('preview')?PreviewHarness:LibraryHarness));
