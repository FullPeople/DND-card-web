import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CharacterManager} from '../../../src/ui/CharacterManager';
import {newCharacter} from '../../../src/core/model';
const mode=new URLSearchParams(location.search).get('mode');
window.removeCalls=[];window.refreshCalls=0;window.copied='';
const error=()=>Object.assign(Error('角色读取暂时失败'),{requestId:'fixture-request',diagnostic:{code:'DOCUMENT_UNAVAILABLE',status:404,operation:'readCards',version:'1.0.243-dev',cookie:'PRIVATE_COOKIE',url:'https://private.invalid/?token=PRIVATE_TOKEN',document:{name:'PRIVATE_CHARACTER'}}});
function Fixture(){
 const [rows,setRows]=useState(['a','b','c'].map(id=>({id,name:'测试 '+id,write:mode!=='readonly'}))),[blocked,setBlocked]=useState([]),[pending,setPending]=useState([]),[mounted,setMounted]=useState(true);
 const remove=async ids=>{window.removeCalls.push(ids);if(mode==='deferred'){setPending(ids);await new Promise(resolve=>{window.finishDelete=resolve;});setRows(current=>current.filter(row=>!ids.includes(row.id)));setPending([]);return;}if(mode==='partial'||mode==='uncertain'){setRows(current=>current.filter(row=>row.id!==ids[0]));if(mode==='uncertain')setBlocked([ids[1]]);throw Object.assign(error(),{completedIds:[ids[0]],uncertain:mode==='uncertain',uncertainIds:mode==='uncertain'?[ids[1]]:[]});}setRows(current=>current.filter(row=>!ids.includes(row.id)));};
 const refresh=async()=>{window.refreshCalls++;if(mode==='refresh-failure')throw error();};
 return <main style={{maxWidth:1000,margin:24,fontFamily:'sans-serif'}}><button onClick={()=>window.finishDelete?.()}>完成在途删除</button><button onClick={()=>setBlocked([])}>明确终态已返回</button><button onClick={()=>setMounted(value=>!value)}>切换角色簿</button>{mounted&&<CharacterManager rows={rows} currentId="a" disabled={false} read={async ids=>{if(mode==='read-error'||mode==='refresh-failure')throw error();return ids.map(id=>({...newCharacter(),id,name:'测试 '+id}));}} open={()=>{}} remove={remove} create={async()=>{}} review={()=>{}} refresh={refresh} blockedDeleteIds={blocked} pendingDeleteIds={pending}/>}</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
