import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EntryMenuProvider,useEntryMenu,useEntryMenuActions,ShareEntryButton} from '../../../src/ui/EntrySharing';
import {newCharacter,type Entry} from '../../../src/core/model';
const make=(id:string,body:string,edition:Entry['edition']='2024'):Entry=>({id,name:id,english:id,kind:'feature',source:'TEST',packId:'fixture',edition,revision:'1',entries:[body],raw:{}});
const privateEntry=make('Private','old private body'),publicEntry=make('Public','public body'),otherEdition=make('Private','other edition body','2014');
function Harness(){
 const [allowed,setAllowed]=useState(true),[privateBody,setBody]=useState('old private body'),[scope,setScope]=useState('room-one'),[writable,setWritable]=useState(true),[editing,setEditing]=useState(true),[character,setCharacter]=useState(()=>newCharacter());
 const readable=[publicEntry,otherEdition,...(allowed?[{...privateEntry,entries:[privateBody]}]:[])];
 const resolve=(entry:Entry)=>readable.find(row=>row.id===entry.id&&row.source===entry.source&&row.packId===entry.packId&&row.edition===entry.edition);
 const record=(kind:string,entry:Entry)=>(window as any).actions.push({kind,entry});
 useEntryMenuActions({character,editing,writable,scope,readableEntry:resolve,add:(entry:Entry)=>record('add',entry),inspect:(entry:Entry)=>record('inspect',entry),canRemoveCustom:()=>true,removeCustom:(entry:Entry)=>record('removeCustom',entry)} as any);
 const menu=useEntryMenu();
 (window as any).harness={revoke:()=>setAllowed(false),restore:()=>setAllowed(true),update:()=>setBody('new private body'),scope:()=>setScope('room-two'),readonly:()=>setWritable(false),editing:()=>setEditing(false),character:()=>setCharacter(newCharacter()),resolve};
 (window as any).actions||=[];
 return <><button onContextMenu={e=>menu?.(e,privateEntry)}>Private anchor</button><button onContextMenu={e=>menu?.(e,publicEntry)}>Public anchor</button><ShareEntryButton entry={privateEntry} done={()=>{}}/></>;
}
createRoot(document.getElementById('root')!).render(<EntryMenuProvider><Harness/></EntryMenuProvider>);
