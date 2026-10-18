import {useState} from 'react';
import {subclassOwner,type Character,type Entry} from '../core/model';
import {requiresEditing} from './DragEntry';

/** Describe the mutation before exposing the action; inspecting never applies. */
export function entryApplyDescription(c:Character,entry:Entry){
 const selected=c.selections.find(row=>row.entry.id===entry.id);
 if(entry.kind==='class'&&selected)return {label:'职业等级 +1',note:`${selected.level} → ${selected.level+1} 级`,replace:false};
 const previous=['race','background','subclass'].includes(entry.kind)?c.selections.filter(row=>row.entry.kind===entry.kind&&row.entry.id!==entry.id&& (entry.kind!=='subclass'||subclassOwner(c,row.entry)?.id===subclassOwner(c,entry)?.id)):[];
 if(previous.length)return {label:'替换角色条目',note:`将替换「${previous.map(row=>row.entry.name).join('、')}」`,replace:true};
 return {label:entry.kind==='item'?'加入背包':entry.kind==='condition'?'添加状态':'填入角色',note:`目标：${c.name||'当前角色'}`,replace:false};
}
export function EntryApplyAction({entry,character,blocked,disabledReason,editing,editReady,enableEditing,apply}:{entry:Entry;character:Character;blocked?:string;disabledReason?:string;editing:boolean;editReady:boolean;enableEditing:()=>void;apply:()=>void}){
 const description=entryApplyDescription(character,entry),needsEditing=requiresEditing(entry)&&!editing;
 const [confirm,setConfirm]=useState(false);
 const reason=disabledReason||blocked;
 return <div className="entry-apply-bar"><div><small>查阅规则</small><span>{reason||description.note}</span></div>{confirm&&!reason&&!needsEditing?<div className="entry-replace-confirm"><strong>{description.note}</strong><button className="primary" onClick={()=>{setConfirm(false);apply();}}>确认替换</button><button onClick={()=>setConfirm(false)}>取消</button></div>:<button className="primary" disabled={!!reason||needsEditing&&!editReady} onClick={()=>{if(needsEditing){enableEditing();return;}if(description.replace){setConfirm(true);return;}apply();}}>{reason?'暂不可填入':needsEditing?editReady?'开启编辑以填入':'编辑功能加载中…':description.label}</button>}</div>;
}
