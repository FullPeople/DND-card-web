import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {VirtualList} from '../../../src/ui/VirtualList';
const rows=Array.from({length:500},(_,i)=>({id:String(i),name:`原创条目 ${i}`}));
(window as any).rowRenders=0;
function Example(){
 const [height,setHeight]=useState(40),[last,setLast]=useState<number>(),[count,setCount]=useState(500),[tick,setTick]=useState(0);
 return <><style>{`.virtual-list{height:240px;width:360px;overflow:auto;border:1px solid #555}.virtual-row{box-sizing:border-box;border-bottom:1px solid #ddd}button{margin:8px}.list-header{height:25px;position:sticky;top:0;background:#ddd}`}</style>
  <button onClick={()=>setHeight(height===40?52:40)}>改变行高</button><button onClick={()=>setLast(499)}>最后一项</button><button onClick={()=>setCount(3)}>缩短列表</button><button onClick={()=>setTick(tick+1)}>更新外部状态 {tick}</button>
  <VirtualList items={rows.slice(0,count)} rowHeight={height} label="检查列表" header={<div className="list-header">目录</div>} itemKey={row=>row.id} scrollToIndex={last} renderRow={row=>{(window as any).rowRenders++;return <span>{row.name}</span>;}}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<Example/>);
