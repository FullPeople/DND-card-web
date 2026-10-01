import {useEffect,useState} from 'react';
import {uid,KIND_LABELS,type Character} from '../core/model';
import {quickbarEntries,removePin} from '../core/quickbar';
import {weaponAttacks} from '../core/weaponAttacks';
import {entryLabel} from '../core/entryLabel';
import './quickbarManager.css';
type ActionDraft={id:string;name:string;attack:string;damage:string};
const blank=():ActionDraft=>({id:'',name:'',attack:'',damage:''});
export function QuickbarManager({c,edit}:{c:Character;edit:(f:(c:Character)=>void)=>void}){
 const [row,setRow]=useState<ActionDraft>(),[error,setError]=useState('');
 useEffect(()=>{setRow(undefined);setError('');},[c.id]);
 const attacks=weaponAttacks(c),pins=quickbarEntries(c),layout=c.quickbarLayout||{order:[],hidden:[]};
 const allAttacks=layout.hidden.length?weaponAttacks({...c,quickbarLayout:{...layout,hidden:[]}}):attacks;
 const hidden=allAttacks.filter(attack=>layout.hidden.includes(attack.key));
 function moveAttack(key:string,offset:number){edit(d=>{
  const keys=weaponAttacks(d).map(attack=>attack.key),index=keys.indexOf(key),to=index+offset;
  if(index<0||to<0||to>=keys.length)return;
  [keys[index],keys[to]]=[keys[to],keys[index]];
  const current=d.quickbarLayout||{order:[],hidden:[]};d.quickbarLayout={...current,order:[...current.order.filter(id=>!keys.includes(id)),...keys]};
 });}
 function movePin(id:string,offset:number){edit(d=>{
  const entries=quickbarEntries(d),index=entries.findIndex(entry=>entry.id===id),to=index+offset;
  if(index<0||to<0||to>=entries.length)return;
  [entries[index],entries[to]]=[entries[to],entries[index]];
  d.quickbarCopies=entries;d.quickbar=[];
 });}
 function hideAttack(key:string){edit(d=>{const current=d.quickbarLayout||{order:[],hidden:[]};d.quickbarLayout={...current,hidden:[...new Set([...current.hidden,key])]};});if(row&&key==='custom:'+row.id)setRow(undefined);}
 function restoreAttacks(){edit(d=>{
  const current=d.quickbarLayout||{order:[],hidden:[]},keys=new Set(weaponAttacks({...d,quickbarLayout:{...current,hidden:[]}}).map(attack=>attack.key));
  d.quickbarLayout={...current,hidden:current.hidden.filter(key=>!keys.has(key))};
 });}
 function save(){
  if(!row?.name.trim())return;
  let applied=false,missing=false;
  edit(d=>{
   const actions=d.quickbarActions||=[],index=row.id?actions.findIndex(action=>action.id===row.id):-1;
   if(row.id&&index<0){missing=true;return;}
   const next={...row,id:row.id||uid(),name:row.name.trim()};
   if(index<0)actions.push(next);else actions[index]=next;
   d.quickbarActions=actions;applied=true;
  });
  if(applied){setRow(undefined);setError('');}else setError(missing?'此手填攻击已不在当前记录中，请重新选择。':'当前无法修改，填写内容已保留。');
 }
 return <div className="quickbar-manager quickbar-organizer">
  <p className="quickbar-organizer-intro">这里整理正在使用的快捷入口。新增条目可从资料或背包拖入快捷栏。</p>
  <section className="quickbar-organizer-section" aria-label="攻击快捷入口">
   <header><h3>武器与攻击</h3><span>{attacks.length} 项</span></header>
   <div className="quickbar-organizer-fixed"><span className="quickbar-organizer-symbol" aria-hidden="true">✦</span><strong>法术攻击</strong><small>随施法属性显示</small></div>
   {attacks.length>0?<ol className="quickbar-organizer-list" aria-label="在用攻击">{attacks.map((attack,index)=>{
    const manual=(c.quickbarActions||[]).find(action=>'custom:'+action.id===attack.key),name=attack.entry?entryLabel(attack.entry):attack.name;
    return <li key={attack.key} className="quickbar-organizer-row" data-organizer-key={attack.key}>
     <span className="quickbar-organizer-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
     <div className="quickbar-organizer-description"><strong>{name}{attack.modeLabel&&<small> · {attack.modeLabel}</small>}</strong><div className="quickbar-organizer-meta"><span>{manual?'手填攻击':attack.entry?'装备攻击':'原有攻击'}</span><span>命中 <b>{attack.attack_bonus??'—'}</b></span><span>伤害 <b>{[attack.damage,attack.extra_damage].filter(Boolean).join(' + ')||'—'}</b>{attack.damage_type&&' '+attack.damage_type}</span></div></div>
     <div className="quickbar-organizer-actions">{manual&&<button type="button" className="quickbar-organizer-edit" aria-label={'编辑'+name} onClick={()=>{setRow({...manual});setError('');}}>编辑</button>}<button type="button" aria-label={'上移'+name} title="上移" disabled={index===0} onClick={()=>moveAttack(attack.key,-1)}>↑</button><button type="button" aria-label={'下移'+name} title="下移" disabled={index===attacks.length-1} onClick={()=>moveAttack(attack.key,1)}>↓</button><button type="button" className="quickbar-organizer-remove" aria-label={'从快捷栏移除'+name} title="从快捷栏移除" onClick={()=>hideAttack(attack.key)}>×</button></div>
    </li>;
   })}</ol>:<p className="quickbar-organizer-empty">还没有武器或手填攻击。</p>}
  </section>
  <section className="quickbar-organizer-section" aria-label="固定条目快捷入口">
   <header><h3>固定条目</h3><span>{pins.length} 项</span></header>
   {pins.length>0?<ol className="quickbar-organizer-list" aria-label="固定条目">{pins.map((pin,index)=>{
    const name=entryLabel(pin.entry);return <li key={pin.id} className="quickbar-organizer-row" data-organizer-key={'pin:'+pin.id}>
     <span className="quickbar-organizer-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
     <div className="quickbar-organizer-description"><strong>{name}</strong><div className="quickbar-organizer-meta"><span>{KIND_LABELS[pin.entry.kind]}</span><span>{pin.entry.source==='CUSTOM'?'自定义':pin.entry.source}</span></div></div>
     <div className="quickbar-organizer-actions"><button type="button" aria-label={'上移'+name} title="上移" disabled={index===0} onClick={()=>movePin(pin.id,-1)}>↑</button><button type="button" aria-label={'下移'+name} title="下移" disabled={index===pins.length-1} onClick={()=>movePin(pin.id,1)}>↓</button><button type="button" className="quickbar-organizer-remove" aria-label={'取消固定'+name} title="取消固定" onClick={()=>edit(d=>removePin(d,pin.id))}>×</button></div>
    </li>;
   })}</ol>:<p className="quickbar-organizer-empty">把常用法术、能力或物品拖到快捷栏，便可在这里整理。</p>}
  </section>
  <footer className="quickbar-organizer-footer"><span>移除快捷入口会保留卡上的原条目。</span><div>{hidden.length>0&&<button type="button" onClick={restoreAttacks}>显示已隐藏攻击（{hidden.length}）</button>}<button type="button" onClick={()=>{setRow(blank());setError('');}}>＋ 新建手填攻击</button></div></footer>
  {row&&<form className="quickbar-organizer-editor" aria-label={row.id?'编辑手填攻击':'新建手填攻击'} onSubmit={e=>{e.preventDefault();save();}}>
   <header><h3>{row.id?'编辑手填攻击':'新建手填攻击'}</h3><button type="button" aria-label="取消编辑手填攻击" onClick={()=>{setRow(undefined);setError('');}}>×</button></header>
   <div className="quickbar-organizer-fields"><label>名字<input autoFocus required maxLength={120} value={row.name} onChange={e=>setRow({...row,name:e.target.value})}/></label><label>命中加值<input maxLength={160} placeholder="+5" value={row.attack} onChange={e=>setRow({...row,attack:e.target.value})}/></label><label>伤害<input maxLength={160} placeholder="1d8+3" value={row.damage} onChange={e=>setRow({...row,damage:e.target.value})}/></label></div>
   {error&&<p role="alert">{error}</p>}<div className="quickbar-organizer-editor-actions"><button type="button" onClick={()=>{setRow(undefined);setError('');}}>取消</button><button type="submit" className="primary">{row.id?'保存':'添加'}</button></div>
  </form>}
 </div>;
}
