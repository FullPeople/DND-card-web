import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {vi} from 'vitest';
import type {Character} from '../src/core/model';
import {AlertControl} from '../src/ui/AlertControl';
import {ClassChoiceRecords} from '../src/ui/ClassChoiceRecords';
import {ChoiceWorkspaceContext} from '../src/ui/ChoiceWorkspaceContext';
import {FeedbackContext} from '../src/ui/InteractionFeedback';
import {RetainedCardVisibility} from '../src/ui/RetainedCardVisibility';
import {setupAlert} from './helpers/reviewedAlertCore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
/** Real frozen catalog and real React events. Only the host edit/persistence
 * boundary is controlled; no rule, status, Reference or engine is mocked. */
export async function setupAlertUI(level=4,slot=0,records=false){
 const source=setupAlert(level),choice=source.select(slot),catalog=source.entries,entry=source.feat;
 let c=source.c,active=true,writable=true,submit=true,unavailable=false,defer=false,saveLabel='已保存到本机',feedbackScope=c.id;
 let mutate:((draft:Character)=>void)|undefined,pending:((draft:Character)=>void)|undefined;
 let root:Root|undefined;
 const host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
 const edit=vi.fn((action:(draft:Character)=>void)=>{
  if(!submit)return;
  if(defer){pending=action;return;}
  const draft=structuredClone(c);mutate?.(draft);action(draft);c=draft;draw();
 });
 function draw(){root!.render(createElement(RetainedCardVisibility.Provider,{value:active},
  createElement(FeedbackContext.Provider,{value:{scope:feedbackScope,saveLabel,announce:()=>{}}},
   createElement(ChoiceWorkspaceContext.Provider,{value:{canEdit:writable,open:()=>{},close:()=>{}}},
    records?createElement(ClassChoiceRecords,{c,catalog,mode:'feat',edit}):createElement(AlertControl,{c,catalog,choiceId:choice.id,entry,writable,unavailable,edit})))));}
 // App edit transactions replace the character. Match that identity contract
 // when tests alter an input before requesting another render.
 const render=async()=>{c={...c};await act(draw);},click=async(node:HTMLElement)=>act(()=>node.click());
 const manual=()=>host.querySelector<HTMLInputElement>('input[aria-label="确认警觉先攻加值未计入手工值"]')!;
 const buttons=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].filter(node=>node.textContent===name);
 const button=(name:string)=>{const found=buttons(name);if(found.length!==1)throw Error(`Expected exactly one authored control button: ${name}; found ${found.length}`);return found[0];};
 async function confirm(){await click(manual());await click(button('确认警觉'));}
 const unmount=async()=>{if(root)await act(()=>root!.unmount());root=undefined;};
 await render();
 return {source,catalog,entry,choice,host,edit,manual,buttons,button,render,click,confirm,unmount,
  cleanup:async()=>{await unmount();host.remove();},text:()=>host.textContent!,
  get c(){return c;},get pending(){return pending;},replace:(value:Character)=>{c=value;},
  set active(value:boolean){active=value;},set writable(value:boolean){writable=value;},
  set unavailable(value:boolean){unavailable=value;},set submit(value:boolean){submit=value;},
  set defer(value:boolean){defer=value;},set saveLabel(value:string){saveLabel=value;},
  set feedbackScope(value:string){feedbackScope=value;},set mutate(value:((draft:Character)=>void)|undefined){mutate=value;},
 };
}
