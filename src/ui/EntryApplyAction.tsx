import {useContext,useLayoutEffect,useState} from 'react';
import {subclassOwner,type Character,type Entry} from '../core/model';
import {requiresEditing} from './entryWritePolicy';
import {entryDragIntent} from './entryDragIntent';
import {EntryApplicationContext,type EntryApplicationTarget} from './entryApplication';

/** Describe the mutation before exposing the action; inspecting never applies. */
export function entryApplyDescription(c:Character,entry:Entry){
 const selected=c.selections.find(row=>row.entry.id===entry.id);
 if(entry.kind==='class'&&selected)return {label:'职业等级 +1',note:`${selected.level} → ${selected.level+1} 级`,replace:false};
 const previous=['race','background','subclass'].includes(entry.kind)?c.selections.filter(row=>row.entry.kind===entry.kind&&row.entry.id!==entry.id&& (entry.kind!=='subclass'||subclassOwner(c,row.entry)?.id===subclassOwner(c,entry)?.id)):[];
 if(previous.length)return {label:'替换角色条目',note:`将替换「${previous.map(row=>row.entry.name).join('、')}」`,replace:true};
 return {label:entry.kind==='item'?'加入背包':entry.kind==='condition'?'添加状态':'填入角色',note:`目标：${c.name||'当前角色'}`,replace:false};
}
export function EntryApplyAction({entry,character,blocked,disabledReason,editing,editReady,enableEditing,apply}:{entry:Entry;character:Character;blocked?:string;disabledReason?:string;editing:boolean;editReady:boolean;enableEditing:()=>void;apply:()=>void}){
 const getTargets=useContext(EntryApplicationContext),[targets,setTargets]=useState<EntryApplicationTarget[]>([]),training=entryDragIntent(entry)==='training';
 useLayoutEffect(()=>{const next=getTargets?.(entry)||[];setTargets(old=>old.length===next.length&&old.every((target,index)=>target.id===next[index].id&&target.label===next[index].label)?old:next);},[getTargets,entry,character,editing]);
 const description=entryApplyDescription(character,entry),needsEditing=requiresEditing(entry)&&!editing;
 const [confirm,setConfirm]=useState(false);
 const reason=disabledReason||blocked||(training&&!needsEditing&&!targets.length?'请先打开角色卡主要页，再填入对应的熟练项。':undefined);
 return <div className="entry-apply-bar"><div><small>查阅规则</small><span>{reason||(training&&targets.length?`填写：${targets.map(target=>target.label).join(' / ')}`:description.note)}</span></div>{confirm&&!reason&&!needsEditing?<div className="entry-replace-confirm"><strong>{description.note}</strong><button className="primary" onClick={()=>{setConfirm(false);apply();}}>确认替换</button><button onClick={()=>setConfirm(false)}>取消</button></div>:training&&targets.length>1&&!needsEditing&&!reason?<div className="entry-targets">{targets.map(target=><button className="primary" key={target.id} onClick={target.apply}>填入{target.label}</button>)}</div>:<button className="primary" disabled={!!reason||needsEditing&&!editReady} onClick={()=>{if(needsEditing){enableEditing();return;}if(training){targets[0]?.apply();return;}if(description.replace){setConfirm(true);return;}apply();}}>{reason?blocked==='这个条目已经在角色卡中'?'已在角色卡中':'暂不可填入':needsEditing?editReady?'开启编辑以填入':'编辑功能加载中…':training?'填入熟练项':description.label}</button>}</div>;
}
