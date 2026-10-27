import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {performSpellAction,spellActionRequest,type SpellActionResult} from '../core/automation/actions';
import type {Edit} from './CharacterPages';
import {useInteractionStatus} from './InteractionFeedback';
import {confirmSpellPresentation,type SpellPresentation as Action} from './spellActionPresentation';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';
import {useRetainedCardActive} from './RetainedCardVisibility';
import {getWorkbench,inWorkbench,useWorkbench,workbenchCharacterId} from '../platform/workbench';
import {localGm} from '../cloud/localRights';
import {qqRoom,roomState} from '../cloud/room';
import './actionPresentation.css';

/** The card's observed receipt confirms the action, not the optimistic draft. */
export function useSpellActionFeedback(c:Character,edit:Edit,readOnly=false){
 useWorkbench(); // Live role/target changes must refresh payment offers, too.
 const workspace=useChoiceWorkspace(),active=useRetainedCardActive();
 const [action,setAction]=useState<Action>(),flight=useRef<string|undefined>(undefined),epoch=useRef(0),mounted=useRef(true);
 const latest=useRef({c,edit,readOnly,active,canEdit:workspace.canEdit});latest.current={c,edit,readOnly,active,canEdit:workspace.canEdit};
 useLayoutEffect(()=>{epoch.current++;},[c.id,readOnly,active,workspace.canEdit]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 function authority(){
  const live=latest.current,wb=getWorkbench(),room=qqRoom?roomState():undefined;
  const canEdit=mounted.current&&live.active&&live.readOnly===false&&(live.canEdit===undefined||live.canEdit===true)&&(!inWorkbench||wb.online&&!!wb.target?.write&&workbenchCharacterId(wb.target)===live.c.id)&&(!qqRoom||room?.write===true&&room.character.id===live.c.id);
  return {canEdit,gm:inWorkbench?wb.role==='GM':localGm()};
 }
 const visible=action?.scope===c.id?action:undefined;
 useLayoutEffect(()=>{const confirmed=confirmSpellPresentation(visible,c.id,c.runtime.automationActions?.last);if(confirmed!==visible){flight.current=undefined;setAction(confirmed);}},[c.runtime.automationActions?.last,c.id,visible]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请查看保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 function run(selectionId:string,payment:string,label:string,mode:'cast'|'restore'='cast',context:{casterId?:string}={}){
  if(flight.current||!authority().canEdit)return;
  const live=latest.current,scope=live.c.id,token=epoch.current;
  const request=spellActionRequest(live.c,selectionId,payment,crypto.randomUUID(),mode,context.casterId);
  const next:Action={id:request.id,scope,title:live.c.selections.find(row=>row.id===selectionId)?.entry.name||'施法',payment:label,mode,phase:'pending'};
  flight.current=request.id;setAction(next);
  let used=false;
  try{
   live.edit(draft=>{
    if(used)return;used=true;
    const access=authority();
    if(token!==epoch.current||latest.current.c.id!==scope||draft.id!==scope||!access.canEdit){if(mounted.current){flight.current=undefined;setAction({...next,phase:'rejected',message:'草稿、卡面或当前编辑权限已变化，未执行。'});}return;}
    const result:SpellActionResult=performSpellAction(draft,request,access);
    if(result.status==='rejected'){flight.current=undefined;setAction({...next,phase:'rejected',message:result.message});}
   });
  }catch(error){flight.current=undefined;setAction({...next,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 return {run,action:visible,busy:visible?.phase==='pending'||visible?.phase==='unconfirmed',authority:authority()};
}
export function SpellActionFeedback({action}:{action?:Action}){
 const status=useInteractionStatus();if(!action)return null;
 const receipt=action.receipt;
 return <section key={action.id} className="spell-action-feedback" data-phase={action.phase} role="status" aria-live="polite">
  <div className="action-seal" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 2 43 13V35L24 46 5 35V13Z"/><path className="action-seal-check" d="m14 24 7 7 14-15"/></svg></div>
  <div><small>{action.mode==='restore'?'次数恢复':action.phase==='applied'?'施法已记录':action.phase==='rejected'?'未执行':'等待卡面确认'}</small><strong>{action.title}</strong><span>{action.message||action.payment}</span>
   {action.phase==='applied'&&<>{receipt?.spent?.length?<><small>{receipt.level} 环施法 · 已同时扣除两项资源</small>{receipt.spent.map(row=><div key={row.resourceId} data-spent-resource={row.resourceId}><small>{/^pact-slot:([1-9])$/.test(row.resourceId)?`${row.resourceId.split(':')[1]}环契约位`:'本祈唤次数'}</small><p className="spell-action-cost"><span>{row.before}</span><i>→</i><b>{row.after}</b></p></div>)}</>:receipt?.resourceId?<p className="spell-action-cost"><span>{receipt.before}</span><i>→</i><b>{receipt.after}</b></p>:<p className="spell-action-cost-free">不消耗资源</p>}<small className="action-save-state">{status?.scope===action.scope?status.saveLabel:'请查看卡面保存状态'}</small></>}
  </div>
 </section>;
}
