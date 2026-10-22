import {useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RetainedCardSheet} from '../../../src/ui/RetainedCardSheet';
import {DragContext} from '../../../src/ui/DragEntry';
import {FeedbackContext} from '../../../src/ui/InteractionFeedback';
import {useSheetContext,useSheetContextProvider} from '../../../src/ui/scopedSheetContext';
import {ChoiceWorkspaceContext,useChoiceWorkspace} from '../../../src/ui/ChoiceWorkspaceContext';
import {ReferenceContext} from '../../../src/ui/Reference';
import {useOwnerReadAction} from '../../../src/ui/useOwnerReadAction';
import type {Character,Entry} from '../../../src/core/model';

const register=()=>()=>{},start=()=>{},announce=()=>{};
const counts:{[name:string]:number}={};(window as any).contextRegressionCounts=counts;
function DragSubscriber({owner}:{owner:string}){const drag=useSheetContext('drag',DragContext);counts[owner]=(counts[owner]||0)+1;return <div data-context-owner={owner}>{drag?.character.id}:{drag?.character.name}</div>;}
function FeedbackSubscriber({owner}:{owner:string}){const feedback=useSheetContext('feedback',FeedbackContext);counts['feedback:'+owner]=(counts['feedback:'+owner]||0)+1;return <span data-feedback-owner={owner}>{feedback?.saveLabel}</span>;}
function ChoiceSubscriber(){const value=useChoiceWorkspace();return <span data-nested-choice>{value.host}</span>;}
function NestedChoice(){const Provider=useSheetContextProvider('choice',ChoiceWorkspaceContext);return <Provider value={{host:'nested choice',open:()=>{},close:()=>{}}}><ChoiceSubscriber/></Provider>;}
function ReadSubscriber(){const reference=useSheetContext('reference',ReferenceContext),[,refresh]=useState(0);useEffect(()=>{const read=()=>refresh(value=>value+1);window.addEventListener('retained-fixture-read',read);return()=>window.removeEventListener('retained-fixture-read',read);},[]);return <span data-retained-read>{reference?.resolve?.('fixture')?.id||'missing'}</span>;}
function OwnerAction({owner,action}:{owner:string;action:()=>void}){useEffect(()=>{((window as any).fixtureOwnerActions||={})[owner]??=action;},[owner,action]);return <button data-owner-action onClick={action}>read current</button>;}
function Fixture(){
 // This fixture exercises context ownership only; it never evaluates a rule,
 // persists a workspace, or imports a real character.
 const [cards,setCards]=useState(()=>['a','b','c'].map(id=>({id,name:id+' original'} as Character))),[index,setIndex]=useState(0),[saveLabel,setSaveLabel]=useState('saved');
 const [access,setAccess]=useState<Record<string,string|undefined>>({}),[catalog,setCatalog]=useState(0);
 const card=cards[index];
 const display=useMemo(()=>catalog?{...card,name:card.name+' source'+catalog}:card,[card,catalog]);
 const read=useOwnerReadAction(card.id,()=>{((window as any).fixtureOwnerActionCalls||=[]).push({owner:card.id,receipt:saveLabel,name:card.name});});
 return <DragContext.Provider value={{editing:false,preservePage:false,intent:'entry',character:display,register,start}}><FeedbackContext.Provider value={{scope:card.id,saveLabel,announce}}><ReferenceContext.Provider value={{resolve:()=>({id:card.id,name:card.name} as Entry),show:()=>{},move:()=>{},leave:()=>{},close:()=>{}}}>
  <style>{'@keyframes retained-fixture-spin{to{transform:rotate(360deg)}}[data-owned-animation]{display:inline-block;animation:retained-fixture-spin 10s linear infinite}'}</style>
  <nav>{cards.map((row,i)=><button key={row.id} onClick={()=>setIndex(i)}>{row.id}</button>)}<button onClick={()=>setSaveLabel(v=>v==='saved'?'saving':'saved')}>receipt</button><button onClick={()=>setCards(old=>old.map((row,i)=>i===index?{...row,name:row.name+' changed'}:row))}>edit</button><button onClick={()=>setAccess(old=>({...old,c:old.c?undefined:'restricted'}))}>permission c</button><button onClick={()=>setCards(old=>[...old,{id:'d',name:'d original'} as Character,{id:'e',name:'e original'} as Character])}>more cards</button><button onClick={()=>setCards(old=>old.filter(row=>row.id!=='b'))}>remove b</button></nav>
  <DragSubscriber owner="shared"/><div data-shared-nested><NestedChoice/></div>
  <button onClick={()=>setCatalog(n=>n+1)}>source update</button>
  <div style={{display:'flex',height:240}}><RetainedCardSheet enabled identity={card.id} scope="fixture" access={access} members={cards} urgentVersion={[card]} version={[display,catalog]}><section style={{background:'white'}}><DragSubscriber owner={card.id}/><span data-render-source>{catalog}</span><FeedbackSubscriber owner={card.id}/><NestedChoice/><ReadSubscriber/><OwnerAction owner={card.id} action={read}/><span data-owned-animation={card.id}>animation</span></section></RetainedCardSheet></div>
 </ReferenceContext.Provider></FeedbackContext.Provider></DragContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
