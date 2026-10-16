import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StockBoard} from '../../src/ui/StockBoard';
import {EntryDragProvider} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
const params=new URLSearchParams(location.search),gm=params.get('gm')==='1';
window.requests=[];
function Fixture(){const [container,setContainer]=useState({id:'public-currency-test',kind:params.get('kind')||'public',name:'原创货币仓库',write:true,locked:params.get('locked')==='1',revision:1,columns:4,capacity:24,items:[{id:'authored-gold',kind:'currency',coin:'gp',name:'金币',quantity:Number(params.get('quantity')||0),slot:0,revision:1,locked:params.get('rowLocked')==='1'}]});return <EntryDragProvider character={newCharacter()} receive={()=>{}}><StockBoard container={container} gm={gm} disabled={params.get('disabled')==='1'} operation={async operation=>{window.requests.push(operation);if(operation.action==='remove')setContainer(current=>({...current,revision:current.revision+1,items:current.items.filter(row=>!operation.ids.includes(row.id))}));}}/></EntryDragProvider>;}
createRoot(document.getElementById('test-root')).render(<Fixture/>);
