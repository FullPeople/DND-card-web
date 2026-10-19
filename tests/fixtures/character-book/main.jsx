import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CharacterManager} from '../../../src/ui/CharacterManager';
import {newCharacter} from '../../../src/core/model';
import '../../../src/ui/uiRefresh.css';
import './style.css';

// Authored test characters only; this origin never reads the player's card store.
const initial=Array.from({length:30},(_,i)=>({id:`sample-${i+1}`,name:i===2?'拥有很长名字的旅行者与向导':`旅行者 ${String(i+1).padStart(2,'0')}`,player:`玩家 ${i+1}`,classes:'战士 3',edition:i%2?'2014':'2024',hp:18,maxHp:24,ac:16,write:i%6!==5}));
function Fixture(){
 const [rows,setRows]=useState(initial),[current,setCurrent]=useState(initial[0].id),[mounted,setMounted]=useState(true),[notice,setNotice]=useState('');
 return <main className="app-shell"><section className="dialog"><h1>角色簿</h1><p>本地交互样例 · 30 张原创测试卡</p><div className="fixture-tools"><button onClick={()=>setMounted(value=>!value)}>切换角色簿</button><output aria-label="操作记录">{notice}</output></div>{mounted&&<CharacterManager rows={rows} currentId={current} disabled={false} open={id=>{setCurrent(id);setNotice(`已打开 ${id}`);}} read={async ids=>ids.map(id=>({...newCharacter(),...rows.find(row=>row.id===id)}))} remove={async ids=>{setRows(current=>current.filter(row=>!ids.includes(row.id)));setNotice(`已删除 ${ids.length} 张测试卡`);}} create={async(names,edition)=>setRows(current=>[...current,...names.map((name,i)=>({id:`created-${current.length+i}`,name,edition,write:true}))])} review={card=>setNotice(`已审阅 ${card.name}`)}/>}</section></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
