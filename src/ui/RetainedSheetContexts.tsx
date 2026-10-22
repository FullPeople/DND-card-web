import {createContext,memo,startTransition,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {afterPaint} from '../platform/afterPaint';
import {DragContext} from './DragEntry';
import {EntryApplicationContext} from './entryApplication';
import {ReferenceContext} from './Reference';
import {ChoiceWorkspaceContext} from './ChoiceWorkspaceContext';
import {SheetChoicesContext} from './SheetChoicesContext';
import {FeedbackContext} from './InteractionFeedback';
import {RetainedCardVisibility,RetainedCardCaptureTarget} from './RetainedCardVisibility';
import {SheetContextScope} from './scopedSheetContext';

const same=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const object=<T,>(before:T|undefined,next:T):T=>{
 if(before===next)return next;
 if(!before||!next||typeof before!=='object'||typeof next!=='object')return next;
 const a=Object.keys(before),b=Object.keys(next);
 return a.length===b.length&&a.every(k=>Object.is((before as any)[k],(next as any)[k]))?before:next;
};
const Content=memo(({children}:{children:ReactNode;version:readonly unknown[]})=><>{children}</>,(a,b)=>same(a.version,b.version));

/** A hidden card must not receive the next card's choices, drag character or
 * numeric feedback scope. Methods relay to live owners; inactive relays do nothing.
 * Providers also keep unchanged warm cards from re-rendering on tab navigation. */
export function RetainedSheetContexts({active,version,urgentVersion,children}:{active:boolean;version:readonly unknown[];urgentVersion:readonly unknown[];children:ReactNode}){
 const outer={drag:useContext(DragContext),application:useContext(EntryApplicationContext),reference:useContext(ReferenceContext),choice:useContext(ChoiceWorkspaceContext),choices:useContext(SheetChoicesContext),feedback:useContext(FeedbackContext)};
 const live=useRef({active,outer});live.current={active,outer};
 const resolver=useRef(outer.reference?.resolve);if(active)resolver.current=outer.reference?.resolve;
 const methods=useRef<Record<string,(...args:any[])=>any>|undefined>(undefined);
 if(!methods.current){
  const relay=(key:keyof typeof outer,name?:string)=>(...args:any[])=>{if(!live.current.active)return key==='application'?[]:undefined;const value=live.current.outer[key] as any;return (name?value?.[name]:value)?.(...args);};
  methods.current={isCaptureTarget:()=>live.current.active,start:relay('drag','start'),application:relay('application'),show:relay('reference','show'),move:relay('reference','move'),leave:relay('reference','leave'),close:relay('reference','close'),resolve:(reference:string,kind?:string)=>resolver.current?.(reference,kind),commit:relay('reference','commit'),choiceOpen:relay('choice','open'),choiceClose:relay('choice','close'),choiceBrowse:relay('choice','browse'),announce:relay('feedback','announce')};
 }
 const f=methods.current;
 const snapshot=useRef<typeof outer|undefined>(undefined);
 if(active||!snapshot.current){
  const previous=snapshot.current;
  snapshot.current={drag:object(previous?.drag,outer.drag&&{...outer.drag,start:f.start}),application:f.application,reference:object(previous?.reference,outer.reference&&{...outer.reference,show:f.show,move:f.move,leave:f.leave,close:f.close,resolve:f.resolve,commit:f.commit}),choice:object(previous?.choice,{...outer.choice,open:f.choiceOpen,close:f.choiceClose,browse:outer.choice.browse?f.choiceBrowse:undefined}),choices:object(previous?.choices,outer.choices),feedback:object(previous?.feedback,outer.feedback&&{...outer.feedback,announce:f.announce})};
 }
 const value=snapshot.current;
 const owned=useRef<SheetContextScope|undefined>(undefined);
 if(!owned.current)owned.current=Object.fromEntries(Object.entries(outer).map(([key,initial])=>[key,createContext(initial)])) as SheetContextScope;
 const scoped=owned.current;
 // Source publication may invalidate a previously opened card. Reveal its
 // existing coherent surface first, then reconcile the new source snapshot as
 // interruptible work. Edits, permissions, page/mode/export and choice routing
 // use the urgent version and must never wait behind this background work.
 const candidate=useRef<{version:readonly unknown[];urgent:readonly unknown[];value:typeof value;children:ReactNode}|undefined>(undefined);
 const before=candidate.current;
 if(!before||!same(before.version,version)||!same(before.urgent,urgentVersion)||(['drag','application','reference','choice','choices'] as const).some(key=>before.value[key]!==value[key]))candidate.current={version,urgent:urgentVersion,value,children};
 const next=candidate.current!,[settled,setSettled]=useState(next),urgent=!same(settled.urgent,urgentVersion);
 useEffect(()=>{
  if(settled===next)return;
  if(urgent){setSettled(next);return;}
  if(!active)return;
  // A React deferred render can still run before the browser presents the
  // newly revealed surface. Allow that presentation and an idle interval first.
  return afterPaint(()=>startTransition(()=>setSettled(next)));
 },[settled,next,urgent,active]);
 const view=urgent?next:settled;
 const visible=view.value,hiddenChoice=useRef<typeof value.choice|undefined>(undefined);
 if(!active&&visible.choice.id)hiddenChoice.current=object(hiddenChoice.current,{...visible.choice,id:undefined,canEdit:false});
 return <SheetContextScope.Provider value={scoped}><RetainedCardVisibility.Provider value={active}><RetainedCardCaptureTarget.Provider value={f.isCaptureTarget}><scoped.drag.Provider value={visible.drag}><scoped.application.Provider value={visible.application}><scoped.reference.Provider value={visible.reference}><scoped.choice.Provider value={!active&&visible.choice.id?hiddenChoice.current!:visible.choice}><scoped.choices.Provider value={visible.choices}><scoped.feedback.Provider value={value.feedback}><Content version={view.version}>{view.children}</Content></scoped.feedback.Provider></scoped.choices.Provider></scoped.choice.Provider></scoped.reference.Provider></scoped.application.Provider></scoped.drag.Provider></RetainedCardCaptureTarget.Provider></RetainedCardVisibility.Provider></SheetContextScope.Provider>;
}
