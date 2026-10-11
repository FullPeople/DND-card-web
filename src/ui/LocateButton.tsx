import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {inWorkbench,useWorkbench,workbenchRequest} from '../platform/workbench';
import {reportWorkbenchError} from './CopyDiagnostic';
import {LocateIconGlyph} from './icons';

export function LocateIcon(){return <LocateIconGlyph size={18}/>;}
export function useCharacterLocation(id?:string){
 const wb=useWorkbench();
 const selected=wb.target,card=id?wb.cards.find(c=>c.id===id)||wb.monsters.find(c=>c.id===id):selected?.cardId?wb.cards.find(c=>c.id===selected.cardId):wb.monsters.find(c=>c.itemId===selected?.itemId)||(selected&&wb.access?.monsters.some(c=>c.itemId===selected.itemId)?{...selected,id:selected.itemId,inScene:true}:undefined);
 const available=inWorkbench&&wb.online&&!!card?.inScene&&!!card.itemId;
 const locate=async()=>{if(!available)return;await workbenchRequest('locate',{key:undefined,itemId:card!.kind==='monster'||card!.kind==='token'?card!.targetId||card!.itemId:`card:${card!.id}`});};
 return {available,locate};
}
export function LocateButton({id}:{id?:string}){
 const {available,locate}=useCharacterLocation(id),[busy,setBusy]=useState(false);
 return <button type="button" className="card-lock card-locate" title={available?'定位到角色':'角色未在当前场景中绑定'} aria-label="定位到角色" disabled={!available||busy} onClick={()=>{if(busy)return;setBusy(true);void locate().catch(reportWorkbenchError).finally(()=>setBusy(false));}}><LocateIcon/></button>;
}
export function CharacterLocateMenu({id,position,close}:{id:string;position:{x:number;y:number};close:()=>void}){
 const {available,locate}=useCharacterLocation(id);
 useEffect(()=>{const dismiss=()=>close(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',key);window.addEventListener('blur',dismiss);return()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',key);window.removeEventListener('blur',dismiss);};},[close]);
 return createPortal(<div className="character-context-menu" role="menu" style={{left:Math.max(8,Math.min(position.x,innerWidth-200)),top:Math.max(8,Math.min(position.y,innerHeight-52))}} onPointerDown={e=>e.stopPropagation()}><button role="menuitem" disabled={!available} onClick={()=>{close();void locate().catch(reportWorkbenchError);}}><LocateIcon/>定位到角色</button></div>,document.body);
}
