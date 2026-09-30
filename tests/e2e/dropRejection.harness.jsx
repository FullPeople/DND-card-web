import React from 'react';
import {createRoot} from 'react-dom/client';
import {EntryDragProvider,EntryDraggable,DropZone} from '../../src/ui/DragEntry';
import {newCharacter} from '../../src/core/model';
const root=createRoot(document.getElementById('test-root'));
window.addEventListener('workbench-error',event=>window.refusals.push(event.detail));
window.renderDrop=({source='XPHB',editing=true,disabledReason}={})=>{
 const c=newCharacter(),entry={id:'gift',name:'验收专长',english:'Authored gift',kind:'feat',source,edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{}};
 window.refusals=[];window.received=[];
 root.render(<EntryDragProvider character={c} editing={editing} disabledReason={disabledReason} receive={e=>window.received.push(e.id)}><EntryDraggable id="drag-source" entry={entry} style={{width:180,height:48}}>验收专长</EntryDraggable><div className="paper" style={{marginTop:40,width:500,height:300}}><DropZone id="drop-target" kinds={['feat']} style={{width:450,height:220,border:'2px solid'}}>专长接收区</DropZone></div></EntryDragProvider>);
};
window.renderDrop();
