import {SpellSlotResources,isSpellSlot} from './SpellSlotResources';
import {saveCondition,useConditionRows} from '../platform/conditions';
import {saveVital} from '../platform/stats';
import {Vitals} from './Vitals';
import {DropZone} from './DragEntry';
import {PublicResources,DuplicateResource} from './PublicResources';
import {ResourceRow,ResourcePresets} from './ResourceRow';
import type {ResourceValue} from './resourcePresets';
import {travelHistory,useActionHistory} from '../platform/actionHistory';
import {saveResource,patchResource} from '../platform/resources';
import {diagnosticText} from './CopyDiagnostic';
import {ResourceEditor} from './ResourceEditor';
import {WorkbenchInventory,inventoryRequest,stockFromEntry} from './StockBoard';
import {useState,useEffect,useRef} from 'react';
import {workbenchRequest,useWorkbench,chooseWorkbench,type CardChoice} from '../platform/workbench';
import {StatInput} from './StatInput';
import {OverviewVisuals,useOverviewVisuals,type OverviewCondition} from './OverviewVisuals';
import {OverviewConditions} from './OverviewConditions';
import {AdaptiveFrameArt} from './AdaptiveCardAtmosphere';
import {useAdaptiveCardGravity} from './useAdaptiveCardGravity';
import {currencyRows} from '../core/currency';
export function DMConsole(_props:{navigate:(page:string)=>void}){
 const wb=useWorkbench(),[error,setError]=useState(''),[kind,setKind]=useState('short'),[text,setText]=useState(''),[busy,setBusy]=useState(false);
 const gm=wb.role==='GM',history=useActionHistory();
 const act=(action:string,extra:Record<string,unknown>={})=>workbenchRequest('console',{action,...extra}).catch(e=>{setError(String(e));});
 const transition=(preview:boolean)=>{setBusy(true);setError('');void act('transitions',{kind,text:text.trim()||'经过了一段时间...',preview}).finally(()=>setBusy(false));};
 return <section className="dm-console"><header className="overview-heading"><h2>总览</h2><button aria-label="撤销" disabled={!history.undo} onClick={()=>void travelHistory()}>↶</button><button aria-label="重做" disabled={!history.redo} onClick={()=>void travelHistory(true)}>↷</button></header>{gm&&<div className="console-tools">{[['timeStop','时停'],['focus','同步视口'],['announcement','观看公告']].filter(([key])=>['announcement','settings'].includes(key)||wb.enabled[key]).map(([action,label])=><button key={action} disabled={!wb.online} aria-pressed={action==='timeStop'?!!wb.console?.timeStop:undefined} onClick={()=>void act(action)}>{label}</button>)}{wb.enabled.portals&&<label><PreferenceSwitch value={wb.console?.portalEffects??true} disabled={!wb.online} change={value=>act('portalEffects',{value})}/>传送特效（所有人）</label>}</div>}{error&&<p role="alert">{error}</p>}
 {gm&&wb.enabled.transitions&&<section className="console-transitions"><h3>转场</h3><div className="console-transition-row"><div className="segmented">{[['short','短休'],['long','长休'],['text','文字']].map(([key,label])=><button key={key} aria-pressed={kind===key} onClick={()=>setKind(key)}>{label}</button>)}</div><button disabled={busy||!wb.online} onClick={()=>transition(true)}>自己预览</button><button disabled={busy||!wb.online} onClick={()=>transition(false)}>播放转场</button></div>{kind==='text'&&<input aria-label="转场文字" placeholder="经过了一段时间..." maxLength={120} value={text} onChange={e=>setText(e.target.value)}/>}</section>}
 {wb.inventory&&wb.enabled.inventory!==false&&<>{gm&&<label className="inventory-steal"><PreferenceSwitch value={wb.inventory.silent} disabled={!wb.online} change={value=>inventoryRequest({action:'silent',value})}/>DM不提示消息</label>}<WorkbenchInventory id={wb.inventory.publicId}/>{wb.enabled.resourceTracker!==false&&<PublicResources/>}</>}{wb.enabled.resourceTracker!==false&&<ResourceOverview/>}
 </section>;
}
function ResourceOverview(){
 const wb=useWorkbench(),gm=wb.role==='GM',[kind,setKind]=useState<'player'|'monster'>('player'),[duplicate,setDuplicate]=useState<{card:CardChoice;resource:ResourceValue}>();
 const setError=(text:string)=>{if(text){const detail=JSON.parse(text);window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:detail.message,diagnostic:text}}));}};
 const roster=(kind==='player'?wb.cards:wb.monsters).filter(c=>c.inScene&&(gm||c.write||!c.locked));
 const give=(resource:ResourceValue,target:string,replace?:boolean)=>{const card=roster.find(c=>c.id===target);if(!card?.write)return;const same=card.resources.find(r=>r.name===resource.name);if(same&&replace===undefined){setDuplicate({card,resource});return;}void saveResource(card,same&&replace?same.id:crypto.randomUUID(),{...resource,automatic:false}).catch(e=>setError(diagnosticText(e)));};
 return <section className="resource-overview"><header className="resource-section-heading"><h3>玩家资源</h3><div className="segmented">{(['player','monster'] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>setKind(k)}>{k==='player'?'玩家':'怪物'}</button>)}</div><ResourcePresets give={give} disabled={!wb.online}/></header><div className="console-roster">{roster.map(card=><ResourceCard key={card.id} card={card} online={wb.online} gm={gm} error={setError}/>)}</div>{duplicate&&<DuplicateResource name={duplicate.resource.name||''} choose={choice=>{if(choice!==null)give(duplicate.resource,duplicate.card.id,choice);setDuplicate(undefined);}}/>}</section>;
}
function ResourceCard({card,online,gm,error}:{card:CardChoice;online:boolean;gm:boolean;error:(value:string)=>void}){
 const wb=useWorkbench(),stockId=card.kind==='monster'?`monster:${card.id}`:`card:${card.id}`,stock=wb.inventory?.containers[stockId];
 const [pending,setPending]=useState<Record<string,{value:ResourceValue|null;turn:number;requestId?:string}>>({}),[editing,setEditing]=useState(''),generation=useRef(0),unknown=useRef(new Map<string,{id:string;value:ResourceValue|null}>());
 const clearPending=(id:string,turn:number)=>setPending(rows=>{if(rows[id]?.turn!==turn)return rows;const next={...rows};delete next[id];return next;});
 useEffect(()=>{const receipt=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.uncertain)return;unknown.current.delete(detail.requestId);queueMicrotask(()=>setPending(rows=>{const matches=Object.entries(rows).filter(([,row])=>row.requestId&&row.requestId===detail.requestId);if(!matches.length)return rows;const next={...rows};for(const [id] of matches)delete next[id];return next;}));};window.addEventListener('workbench-operation-result',receipt);window.addEventListener('workbench-operation-reconciled',receipt);return()=>{window.removeEventListener('workbench-operation-result',receipt);window.removeEventListener('workbench-operation-reconciled',receipt);};},[]);
 useEffect(()=>{for(const [requestId,row] of unknown.current){const live=card.resources.find(r=>r.id===row.id),matches=row.value?!!live&&Object.entries(row.value).every(([key,value])=>JSON.stringify(live[key])===JSON.stringify(value)):!live;if(matches){unknown.current.delete(requestId);window.dispatchEvent(new CustomEvent('workbench-operation-reconciled',{detail:{requestId}}));}}},[card.resources,pending]);
 const conditionTarget=card.kind==='monster'?card.itemId:`card:${card.id}`;
 const conditions=useConditionRows(conditionTarget,card.conditions||[]);
 const visuals=useOverviewVisuals(conditions),physical=useRef<HTMLDivElement>(null);
 useAdaptiveCardGravity(physical,visuals.active.has('incapacitated'),card.id,card.resources.map(r=>r.id).join('|'),false,{expand:true});
 const frame=()=> <AdaptiveFrameArt active={visuals.active} exhaustion={visuals.exhaustion} outline={false}/>;
 const changeCondition=(action:'add'|'remove'|'transfer',condition:OverviewCondition,to?:string)=>{void saveCondition(conditionTarget,action,condition,to).catch(e=>error(diagnosticText(e)));};
 const canReceiveCondition=online&&(card.write||!card.locked);
 const editable=online&&card.write,request=(kind:string,extra:Record<string,unknown>)=>workbenchRequest(kind,{key:undefined,itemId:card.kind==='monster'?card.itemId:`card:${card.id}`,...extra});
 const save=(id:string,resource:ResourceValue|null,patch?:Partial<ResourceValue>)=>{const turn=++generation.current;setPending(rows=>({...rows,[id]:{value:resource,turn}}));error('');return (patch?patchResource(card,id,patch):saveResource(card,id,resource)).then(result=>{clearPending(id,turn);return result;}).catch(e=>{if(e?.uncertain){if(e.requestId&&!e.queueBlocked)unknown.current.set(e.requestId,{id,value:resource});setPending(rows=>rows[id]?.turn===turn?{...rows,[id]:{...rows[id],requestId:e.requestId}}:rows);}else clearPending(id,turn);error(diagnosticText(e));throw e;});};
 const value=(key:string,label:string)=><StatInput label={`${card.name}${label}`} value={card.stats[key]??0} disabled={!editable} commit={expression=>saveVital(card,key,expression,label).catch(e=>{error(diagnosticText(e));throw e;})}/>;
 const resourceMap=new Map<string,ResourceValue>(card.resources.map(r=>[r.id,r]));for(const [id,row] of Object.entries(pending)){if(row.value)resourceMap.set(id,{...row.value,id});else resourceMap.delete(id);}const resources=[...resourceMap.values()];
 const resourceRow=(r:ResourceValue)=><div className="resource179-physical" data-adaptive-physical="overview-resource" key={r.id}><ResourceRow resource={r} confirmedCurrent={card.resources.find(row=>row.id===r.id)?.current} label={card.name} enabled={editable} gm={gm} change={n=>save(r.id!,{...r,current:n},{current:n})} configure={()=>setEditing(r.id!)} lock={()=>void save(r.id!,{...r,locked:!r.locked},{locked:!r.locked}).catch(()=>{})}/>{frame()}</div>;
 return <DropZone className="overview-give-zone" kinds={['item','condition']} allowExisting accepts={entry=>entry.kind==='condition'?canReceiveCondition:editable&&!!stock} onReceive={entry=>{if(entry.kind==='condition'){changeCondition('add',{id:entry.id,name:entry.name,entry});return;}if(stock)void inventoryRequest({action:'add',container:stock.id,expected:{[stock.id]:stock.revision},row:stockFromEntry(entry)}).catch(e=>error(diagnosticText(e)));}}><OverviewVisuals visuals={visuals} data-resource-scope="player" data-resource-target={card.id} data-inventory-recipient={stockId} data-condition-recipient={card.kind==='monster'?card.itemId:`card:${card.id}`} data-condition-write={editable} data-condition-receive={canReceiveCondition}>
 <header className="resource179-heading"><button className="resource179-name" data-adaptive-prone onClick={()=>chooseWorkbench(card.itemId)}><span>{card.name}</span>{'player' in card&&typeof card.player==='string'&&card.player&&<small>{card.player}</small>}</button><OverviewConditions conditions={conditions} editable={editable} source={card.kind==='monster'?card.itemId:`card:${card.id}`} change={changeCondition}/><button className="resource179-add" aria-label={`管理${card.name}资源`} disabled={!editable} onClick={()=>setEditing('new')}>＋</button></header>
 <div className="resource179-body adaptive-physics-area" ref={physical}><div className="resource179-vitals resource179-physical" data-adaptive-physical="overview-vitals" data-adaptive-speed><Vitals stats={card.stats} input={value} locked={card.locked} lockLabel={`${card.name}${card.locked?'解锁':'上锁'}`} disabled={!editable} lock={()=>void request('lock',{locked:!card.locked}).catch(e=>error(diagnosticText(e)))}/>{frame()}</div>
 <div className="overview-passive resource179-physical" data-adaptive-physical="overview-passive">被动察觉 <b>{card.passive??'—'}</b>{frame()}</div>
 <div className="overview-character-facts" data-adaptive-physical="overview-coins">{currencyRows(card.coins).map(row=><span key={row.coin}>{row.amount} {row.name}</span>)}</div>
 <div className="resource179-flow"><SpellSlotResources rows={resources} render={r=>resourceRow(r)}/>{resources.filter(r=>!isSpellSlot(r.id||'')).map(r=>resourceRow(r))}</div></div>
 </OverviewVisuals>{editing&&<ResourceEditor key={editing} gm={gm} value={card.resources.find(r=>r.id===editing)} disabled={!editable} close={()=>setEditing('')} save={resource=>save(editing==='new'?crypto.randomUUID():editing,resource)} remove={editing==='new'?undefined:()=>save(editing,null)}/>}
 </DropZone>;
}

function PreferenceSwitch({value,disabled,change}:{value:boolean;disabled:boolean;change:(value:boolean)=>Promise<unknown>}){const [draft,setDraft]=useState(value),[pending,setPending]=useState(false);useEffect(()=>{if(!pending)setDraft(value);},[value,pending]);return <input type="checkbox" checked={draft} disabled={disabled||pending} onChange={e=>{const next=e.target.checked;setDraft(next);setPending(true);void change(next).finally(()=>setPending(false));}}/>;
}
