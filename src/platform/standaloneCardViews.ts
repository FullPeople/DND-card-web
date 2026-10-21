import type {Character,Entry,RulePack} from '../core/model';
import {runtimeCharacterBase} from '../core/runtimeCharacterEdit';
import {withSiteSources,type SiteSources} from '../core/siteSources';
import {automationNeedsInitialization,initializeAutomation} from '../core/automation/state';
import {syncAutoResources} from '../core/resources';
import {sheetChoices} from '../core/automation/choices';
import {evaluate} from '../core/engine';
import {cardMigrationIssues} from '../core/cardMigrationIssues';
import {acknowledgedView} from './choiceReview';
import type {snapshotMemo} from './snapshotMemo';

/** One rule/source context; shared by visible cards and import preparation.
 * Views are disposable. Preparing them must never save or mutate a character. */
export function standaloneCardViews(entries:Entry[],sources:SiteSources|undefined,packs:RulePack[],remember:ReturnType<typeof snapshotMemo>){
 const ready=new WeakSet<Character>();
 const build=(character:Character):Character=>{
  const base=runtimeCharacterBase(character);
  return remember('build',base,()=>{
   const profile=remember('profile',base.profile,()=>withSiteSources(base,sources,packs).profile);
   let effective=sources?{...base,profile,rulePacks:packs}:base;
   if(automationNeedsInitialization(effective)){
    const draft=structuredClone(effective);
    if(initializeAutomation(draft)){syncAutoResources(draft);effective=draft;}
   }
   return acknowledgedView(effective,sheetChoices(effective,entries));
  });
 };
 const display=(character:Character):Character=>remember('display',character,()=>{
  const view=build(character);
  return character===runtimeCharacterBase(character)?view:{...view,runtime:character.runtime,spellSettings:character.spellSettings,revision:character.revision,updatedAt:character.updatedAt};
 });
 return {build,display,ready:(card:Character)=>ready.has(card),
  steps:(card:Character)=>[
   ()=>{build(card);display(card);},
   ()=>remember('choices',build(card),()=>sheetChoices(build(card),entries)),
   ()=>remember('review',build(card),()=>cardMigrationIssues(build(card),entries)),
   ()=>remember('derived',display(card),()=>evaluate(display(card))),
  ],
  complete:(card:Character)=>{ready.add(card);},
 };
}
export type StandaloneCardViews=ReturnType<typeof standaloneCardViews>;

export class CardPreparationContextChanged extends Error{}
const aborted=()=>new DOMException('角色卡准备已取消，尚未导入。','AbortError');

/** Yield between expensive stages, rather than blocking the entire import batch. */
export function yieldCardPreparation(signal:AbortSignal,idle=false):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(aborted());return;}
  let cancel:()=>void;
  const finish=()=>{signal.removeEventListener('abort',abort);resolve();};
  const abort=()=>{cancel();reject(aborted());};
  if(idle&&typeof requestIdleCallback==='function'){
   const id=requestIdleCallback(finish,{timeout:1500});cancel=()=>cancelIdleCallback(id);
  }else{const id=setTimeout(finish,0);cancel=()=>clearTimeout(id);}
  signal.addEventListener('abort',abort,{once:true});
 });
}
export async function prepareStandaloneCards(cards:Character[],views:StandaloneCardViews,options:{signal:AbortSignal;current:()=>boolean;progress?:(completed:number,total:number)=>void;yield?:()=>Promise<void>}){
 const check=()=>{if(options.signal.aborted)throw aborted();if(!options.current())throw new CardPreparationContextChanged();};
 const pause=options.yield||(()=>yieldCardPreparation(options.signal));
 for(let index=0;index<cards.length;index++){
  check();options.progress?.(index,cards.length);
  if(!views.ready(cards[index])){
   for(const step of views.steps(cards[index])){await pause();check();step();}
   check();views.complete(cards[index]);
  }
  options.progress?.(index+1,cards.length);
 }
 check();
}
