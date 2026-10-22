import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Entry} from '../../../src/core/model';
import {KeywordPreview} from '../../../src/ui/KeywordPreview';
import {Reference} from '../../../src/ui/Reference';
import '../../../src/ui/workspace.css';
import '../../../src/ui/overview.css';
import '../../../src/ui/library.css';
import '../../../src/ui/libraryRefine.css';
import './style.css';

const entry=(id:string,entries:unknown[]):Entry=>({id,name:id,english:id,kind:'feature',source:'CUSTOM',edition:'both',packId:'fixture',revision:'1',raw:{},entries});
const entries=[
  entry('短说明',['原创短说明。']),
  entry('长说明',['嵌套参阅 {@feat 短说明|CUSTOM}。',...Array.from({length:70},(_,i)=>`原创滚动段落 ${i+1}。这段正文用于验证说明内部滚动。`)]),
  entry('表格说明',[{type:'table',colLabels:['甲','乙'],rows:[['原创宽表格甲','原创宽表格乙']]},...Array.from({length:55},(_,i)=>`原创表格后的段落 ${i+1}。`)]),
];
function Links(){return <nav className="fixture-links">{entries.map(row=><Reference key={row.id} reference={row.id}>{row.name}</Reference>)}</nav>;}
function Fixture(){
  const [modal,setModal]=useState(false),[secondary,setSecondary]=useState(false);
  useEffect(()=>{document.body.style.overflow=modal?'hidden':'';return()=>{document.body.style.overflow='';};},[modal]);
  return <KeywordPreview resolve={reference=>entries.find(row=>row.id===reference.split('|')[0])} open={()=>{}} wikiVisible={()=>false}>
    <button className="fixture-open-modal" onClick={()=>setModal(true)}>打开测试弹窗</button>
    <button onClick={()=>setSecondary(true)}>显示右侧阅读区</button>
    <section id="reading-panel" aria-label="底层阅读区"><div className="fixture-reading-content"><Links/><p>原创底层阅读内容。</p></div></section>
    {secondary&&<section id="secondary-panel" aria-label="右侧阅读区"><div className="fixture-reading-content">另一独立阅读区。</div></section>}
    {modal&&<div className="fixture-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="滚轮测试弹窗"><button onClick={()=>setModal(false)}>关闭测试弹窗</button><div id="modal-reading" aria-label="弹窗阅读区"><div className="fixture-reading-content"><Links/><p>原创弹窗阅读内容。</p></div></div></section></div>}
  </KeywordPreview>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
