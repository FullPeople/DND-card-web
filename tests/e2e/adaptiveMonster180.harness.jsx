import React from 'react';
import {createRoot} from 'react-dom/client';
import {WorkbenchMonster} from '../../src/ui/Workbench';
import {EntryDragProvider,EntryDraggable} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
import {useWorkbench} from '../../src/platform/workbench';

const session='adaptive180',names={prone:'倒地',restrained:'束缚',grappled:'受擒',charmed:'魅惑',deafened:'耳聋',blinded:'目盲',poisoned:'中毒',bloodied:'浴血',concentration:'专注',petrified:'石化',frightened:'恐慌',unconscious:'昏迷',exhaustion:'力竭',stunned:'震慑'};
const condition=id=>({id,name:names[id]||id,level:id==='exhaustion'?3:1,entry:{id:'suite-condition:'+id,kind:'condition',name:names[id]||id,english:id,source:'CUSTOM',edition:'both',packId:'test',revision:'1',entries:['为状态自适应界面编写的验收文字。'],raw:{_suiteStatusId:id}}});
const item={id:'rope',kind:'item',name:'探险绳索',quantity:2,slot:0,revision:1,unitWeight:5,entry:{id:'custom:rope',kind:'item',name:'探险绳索',english:'Rope',source:'CUSTOM',edition:'both',packId:'test',revision:'1',entries:['为背包状态效果编写的测试物品。'],raw:{weight:5,value:100}}};
let sequence=0,target={key:'test:monster:goblin',itemId:'goblin',slug:'TEST::Adaptive Goblin',name:'石桥守卫',kind:'monster',write:true,role:'GM',locked:false,statsLocked:false,pinned:false,conditions:[],resources:[],stats:{health:24,'max health':36,'temporary health':4,'armor class':15}},raw={name:'石桥守卫',ENG_name:'Bridge Keeper',source:'CUSTOM',size:['M'],type:'humanoid',alignment:['N'],str:14,dex:14,con:12,int:10,wis:12,cha:8,ac:[15],hp:{average:36,formula:'6d8+6'},speed:{walk:30},cr:'2',save:{str:'+4',dex:'+4'},skill:{athletics:'+4',perception:'+3'},passive:13,languages:['通用语'],trait:[{name:'据守',entries:['为测试制作的特性说明。保留紧凑正文与可读布局。']}],action:[{name:'长剑',entries:['{@atk mw} {@hit 4}，触及5尺。{@h}7（{@damage 1d8+3}）挥砍伤害。']} ]};
const inventory={revision:1,publicId:'public:test',containers:{'monster:goblin':{id:'monster:goblin',name:'石桥守卫',kind:'monster',write:true,revision:1,columns:4,capacity:20,items:[item,{...item,id:'torch',slot:1,name:'火把',quantity:6,entry:{...item.entry,id:'custom:torch',name:'火把'}}]}}};
window.requests=[];window.emit180=(type,rest={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,type,...rest}}));
const emit=window.emit180;
function selection(){emit('selection',{sequence:++sequence,state:{...target},document:{...raw}});}
window.setMonsterConditions=ids=>{target={...target,conditions:ids.map(condition)};selection();};
window.setMonsterName=name=>{target={...target,name};raw={...raw,name};selection();};
window.addEventListener('message',event=>{
 const m=event.data;if(event.source!==window||m.protocol!=='full-suite-workbench/v1'||m.session!==session||!m.requestId||m.type==='ack')return;window.requests.push(m);
 if(m.type==='stats')target={...target,stats:{...target.stats,...m.patch}};
 if(m.type==='monsterSave'){raw={...m.data};target={...target,name:raw.name};}
 if(m.type==='condition')target={...target,conditions:m.action==='remove'?target.conditions.filter(c=>c.id!==m.condition.id):[...target.conditions.filter(c=>c.id!==m.condition.id),m.condition]};
 const snapshot={sequence:++sequence,state:{...target},document:{...raw}};
 emit('ack',{requestId:m.requestId,ok:true,result:{snapshot,snapshots:m.type==='condition'?[snapshot]:undefined}});
});
const char={...newCharacter(),id:'monster-harness'};
function Harness(){const wb=useWorkbench();return <EntryDragProvider character={char} receive={()=>{}}><div id="test-wiki"><EntryDraggable entry={condition('restrained').entry} id="wiki-condition-180">束缚条目</EntryDraggable></div><section className="sheet-pane" style={{height:'calc(100vh - 35px)',width:'100%',display:'flex',flexDirection:'column',minHeight:0}}>{wb.target&&<WorkbenchMonster target={wb.target} raw={wb.document||raw} online={true} onLink={()=>{}}/>}</section></EntryDragProvider>;}
createRoot(document.getElementById('test-root')).render(<Harness/>);
emit('ready');emit('catalog',{sequence:++sequence,role:'GM',enabled:{inventory:true},cards:[],monsters:[{...target}],inventory});selection();
