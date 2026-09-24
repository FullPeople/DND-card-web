import {saveVital} from '../platform/stats';
import {Vitals} from './Vitals';
import {SheetCell} from './SheetCell';
import {LockIcon} from './ResourceEditor';
import {reportWorkbenchError} from './CopyDiagnostic';
import {PaperFrame,type SheetPage} from './PaperFrame';
import {SheetFullscreenButton} from './SheetFullscreenButton';
import {travelHistory,useActionHistory} from '../platform/actionHistory';
import {SheetEditContext} from './SheetEdit';
import {WorkbenchInventory} from './StockBoard';
import {inventoryRequest,stockFromEntry} from './StockBoard';
import {saveCondition,useConditionRows} from '../platform/conditions';
import {useOverviewVisuals,type OverviewCondition} from './OverviewVisuals';
import {OverviewConditions} from './OverviewConditions';
import {DropZone} from './DragEntry';
import {MonsterEditor} from './MonsterEditor';
import './monsterEditor.css';
import {useState,useEffect,useRef} from 'react';
import {pinWorkbench,workbenchDiagnostics,workbenchRequest,useWorkbench,chooseWorkbench,composeRoll,type Target} from '../platform/workbench';
import {MonsterDocument} from './MonsterDocument';
import {StatInput} from './StatInput';
import {DMConsole} from './WorkbenchConsole';
export {DMConsole};
import type {Entry} from '../core/model';
import './workbench.css';
export function WorkbenchBar({online,target,message,page,change}:{online:boolean;target?:Target;message:string;page:string;change:(page:string)=>void;save:()=>void}){
 const wb=useWorkbench(),strip=useRef<HTMLDivElement>(null),gesture=useRef<{id:number;x:number;left:number;moved:boolean}|undefined>(undefined),suppress=useRef(false);
 useEffect(()=>{const el=strip.current;if(!el)return;const wheel=(event:WheelEvent)=>{if(el.scrollWidth<=el.clientWidth)return;const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;if(!delta)return;event.preventDefault();el.scrollLeft+=delta;};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 return <><nav className="workbench-bar" aria-label="枭熊工作台"><button type="button" role="status" title={message||'点击查看连接诊断'} onClick={()=>window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:'连接诊断',diagnostic:JSON.stringify({product:'Full Suite',at:new Date().toISOString(),...workbenchDiagnostics()},null,2)}}))} className={online?'linked':'disconnected'}>{online?'● 已连接':'○ 重连中'}</button><strong>{target?.name||'Full Suite'}</strong><label><input type="checkbox" checked={!target?.pinned} disabled={!online} onChange={e=>pinWorkbench(!e.target.checked)}/>跟随选择</label></nav>
 <nav className="workbench-modes" aria-label="功能页"><button className={`workbench-mode ${page==='console'?'active':''}`} onClick={()=>change('console')}>总览</button><button disabled={!online||wb.enabled.dice===false} className={`workbench-mode ${page==='dice'?'active':''}`} onClick={()=>change('dice')}>投骰</button>{wb.role==='GM'&&<button className={`workbench-mode ${page==='notes'?'active':''}`} onClick={()=>change('notes')}>笔记</button>}{wb.enabled.musicBoard&&<button className={`workbench-mode ${page==='music'?'active':''}`} onClick={()=>change('music')}>音乐板</button>}</nav>
 <div ref={strip} className="character-tabs workbench-cards" role="tablist" aria-label="房间角色卡" onPointerDown={event=>{if(event.button!==0||event.pointerType==='touch')return;gesture.current={id:event.pointerId,x:event.clientX,left:event.currentTarget.scrollLeft,moved:false};suppress.current=false;}} onPointerMove={event=>{const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x;if(!g.moved&&Math.abs(dx)<5)return;if(!g.moved){g.moved=true;event.currentTarget.setPointerCapture(event.pointerId);}event.preventDefault();event.currentTarget.scrollLeft=g.left-dx;}} onPointerUp={event=>{const g=gesture.current;if(!g||g.id!==event.pointerId)return;suppress.current=g.moved;gesture.current=undefined;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{gesture.current=undefined;suppress.current=false;}} onClickCapture={event=>{if(suppress.current){event.preventDefault();event.stopPropagation();suppress.current=false;}}}>
 {(wb.enabled.characterCards===false?[]:wb.cards).map(card=><button role="tab" key={card.id} aria-selected={page==='sheet'&&target?.cardId===card.id} disabled={!online} onClick={()=>{change('sheet');chooseWorkbench(card.itemId);}}>{card.name}</button>)}</div><RollPicker/></>;
}

function DiceFrame({quick,expression='',label='',close}:{quick?:boolean;expression?:string;label?:string;close?:()=>void}){
 const ref=useRef<HTMLIFrameElement>(null),wb=useWorkbench(),latest=useRef(wb),lastRolls=useRef(new Set<string>());latest.current=wb;
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==ref.current?.contentWindow||event.origin!==location.origin||event.data?.channel!=='workbench-dice-frame/v1')return;const m=event.data;if(m.ready){for(const roll of [...latest.current.rolls].reverse())ref.current?.contentWindow?.postMessage({channel:m.channel,event:'com.obr-suite/dice-roll',data:{data:roll}},location.origin);return;}if(m.close){close?.();return;}if(typeof m.id!=='string'||typeof m.method!=='string')return;void workbenchRequest('diceRpc',{method:m.method,args:m.args}).then(result=>ref.current?.contentWindow?.postMessage({channel:m.channel,id:m.id,result},location.origin)).catch(error=>{ref.current?.contentWindow?.postMessage({channel:m.channel,id:m.id,error:String(error)},location.origin);window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(error)}));});};
  const emit=(event:Event)=>{const m=(event as CustomEvent).detail;if(['com.obr-suite/dice-roll','com.obr-suite/sfx'].includes(m.event))return;ref.current?.contentWindow?.postMessage({channel:'workbench-dice-frame/v1',...m},location.origin);};window.addEventListener('message',receive);window.addEventListener('workbench-dice-event',emit);return()=>{window.removeEventListener('message',receive);window.removeEventListener('workbench-dice-event',emit);};},[close]);
 useEffect(()=>{if(!wb.online)return;void workbenchRequest('diceRpc',{method:'init',args:[]}).then(data=>ref.current?.contentWindow?.postMessage({channel:'workbench-dice-frame/v1',event:'snapshot',data},location.origin)).catch(()=>{});},[wb.target?.key,wb.role]);
 useEffect(()=>{for(const roll of [...wb.rolls].reverse())if(!lastRolls.current.has(roll.rollId)){lastRolls.current.add(roll.rollId);ref.current?.contentWindow?.postMessage({channel:'workbench-dice-frame/v1',event:'com.obr-suite/dice-roll',data:{data:roll}},location.origin);}},[wb.rolls]);
 const src=new URL('../workbench-dice/'+(quick?'quick.html':'index.html'),location.href.split('#')[0]);src.searchParams.set('v',import.meta.url.split('/').pop()||'');if(quick){src.searchParams.set('expr',expression);src.searchParams.set('label',label);}
 return <iframe ref={ref} className={quick?'original-quick-dice':'original-dice-panel'} title={quick?'投骰调整原面板':'原版投骰面板'} src={src.href}/>;
}
export function RollPicker(){const wb=useWorkbench(),[roll,setRoll]=useState<{expression:string;label?:string;id:string}>();
 useEffect(()=>{const open=(event:Event)=>setRoll((event as CustomEvent).detail);window.addEventListener('workbench-compose-local',open);return()=>window.removeEventListener('workbench-compose-local',open);},[]);
 useEffect(()=>{if(wb.compose)composeRoll(wb.compose.expression,wb.compose.label);},[wb.compose?.id]);
 if(!roll)return null;return <div className="roll-picker-shade" onPointerDown={e=>{if(e.target===e.currentTarget)setRoll(undefined);}}><div role="dialog" aria-modal="true" aria-label="投骰调整" className="original-quick-wrap"><DiceFrame key={roll.id} quick expression={roll.expression} label={roll.label} close={()=>setRoll(undefined)}/></div></div>;
}
export function DicePage(_props:{online:boolean;target?:Target;rolls:any[];compose?:{id:string;expression:string;label?:string}}){return <section className="workbench-dice" aria-label="投骰工作区"><DiceFrame/></section>;}
export function WorkbenchMonster({target,raw,online,onLink}:{target:Target;raw:any;online:boolean;onLink:(reference:string,kind?:string)=>void}){
 const [page,setPage]=useState<SheetPage>('主要'),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false);
 const wb=useWorkbench(),conditions=useConditionRows(target.itemId,target.conditions||[]),{character}=useOverviewVisuals(conditions),frame={...character,id:target.key};
 const stockId=`monster:${target.itemId}`,stock=wb.inventory?.containers[stockId],canReceiveCondition=online&&(target.write||!target.locked);
 const history=useActionHistory();
 const entry:Entry={id:`suite-monster:${target.slug}`,kind:'monster',name:raw?.name||target.name,english:raw?.ENG_name||raw?.name||target.name,source:raw?.source||'CUSTOM',edition:'both',packId:'suite',revision:'live',entries:[],raw:raw||{}};
 const disabled=!online||!target.write,setError=reportWorkbenchError;
 const changeCondition=(action:'add'|'remove'|'transfer',condition:OverviewCondition,to?:string)=>{void saveCondition(target.itemId,action,condition,to).catch(setError);};
 const input=(key:string,label:string)=><StatInput key={`${target.key}:${key}`} label={`怪物${label}`} value={target.stats[key]??0} disabled={disabled} commit={expression=>saveVital(target,key,expression,label).catch(e=>{setError(e);throw e;})}/>;

 return <><div className="pane-toolbar"><strong>怪物卡</strong><div className="toolbar-actions"><SheetFullscreenButton/><button aria-label="撤销" disabled={!history.undo} onClick={()=>void travelHistory()}>↶</button><button aria-label="重做" disabled={!history.redo} onClick={()=>void travelHistory(true)}>↷</button><span className="paper-size">A4</span></div></div><SheetEditContext.Provider value={editing}><PaperFrame character={frame} page={page} changePage={setPage} pages={['主要','背包']} effectLayout="adaptive">
 <div className="paper-heading"><span>DUNGEONS &amp; DRAGONS</span><span className="paper-heading-right"><button className="card-lock" aria-label={target.locked?'解锁怪物卡':'上锁怪物卡'} aria-pressed={!!target.locked} disabled={disabled} onClick={()=>void workbenchRequest('lock',{locked:!target.locked}).catch(setError)}><LockIcon locked={!!target.locked}/></button><button className="edit-mode-toggle" role="switch" aria-label="怪物编辑模式" aria-checked={editing} disabled={disabled} onClick={()=>setEditing(v=>!v)}><span className="edit-switch-track"><i/></span>编辑模式</button></span></div>
 <DropZone className="workbench-monster" data-inventory-recipient={stockId} data-condition-recipient={target.itemId} data-condition-write={!disabled} data-condition-receive={canReceiveCondition} kinds={['item','condition']} allowExisting wholePaper accepts={entry=>entry.kind==='condition'?canReceiveCondition:!disabled&&!!stock} onReceive={entry=>{if(entry.kind==='condition')changeCondition('add',{id:entry.id,name:entry.name,entry});else if(stock)void inventoryRequest({action:'add',container:stock.id,expected:{[stock.id]:stock.revision},row:stockFromEntry(entry)}).catch(setError);}}><header><h1><button className="assign-token-name" disabled={disabled} onClick={()=>void workbenchRequest('assignName',{name:entry.name}).catch(setError)}>{target.name}</button></h1><OverviewConditions conditions={conditions} editable={!disabled} source={target.itemId} change={changeCondition}/></header>
 {page==='背包'?<WorkbenchInventory id={`monster:${target.itemId}`}/>:<><Vitals stats={target.stats} input={input} locked={target.statsLocked!==false} lockLabel={target.statsLocked!==false?'解锁怪物生命条':'锁定怪物生命条'} disabled={!online} lock={target.role==='GM'?()=>void workbenchRequest('statsLock',{locked:target.statsLocked===false}).catch(setError):undefined}/><SheetCell label="怪物资料" className="monster-paper-content">{editing?<MonsterEditor key={target.key} value={raw||{name:target.name}} busy={saving} save={async data=>{setSaving(true);try{await workbenchRequest('monsterSave',{data,expected:raw});setEditing(false);}finally{setSaving(false);}}}/>:raw&&<MonsterDocument entry={entry} onLink={onLink}/>}</SheetCell></>}
 </DropZone></PaperFrame></SheetEditContext.Provider><div className="save-status"><span>{online?'与枭熊同步':'等待枭熊重连'}</span><span>角色资料自动保存</span></div></>;
}
