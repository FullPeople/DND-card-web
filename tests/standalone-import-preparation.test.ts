import {expect,it,vi} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {settledSnapshotCheck} from '../src/platform/settledSnapshotCheck';
import {sheetChoices} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {cardMigrationIssues} from '../src/core/cardMigrationIssues';
import {applyRuntimeCharacterEdit,runtimeValueEdit} from '../src/core/runtimeCharacterEdit';
import {snapshotMemo} from '../src/platform/snapshotMemo';
import {acknowledgedView} from '../src/platform/choiceReview';
import {standaloneCardViews,prepareStandaloneCards,CardPreparationContextChanged,yieldCardPreparation} from '../src/platform/standaloneCardViews';

const entries:Entry[]=Array.from({length:80},(_,i)=>({id:'prepare-fixture:'+i,kind:'feature',name:'Authored feature '+i,english:'Authored feature '+i,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['Authored import preparation fixture.'],raw:{}}));
function card(){const c=newCharacter();c.automation=newAutomationState();c.selections=entries.map(entry=>({id:entry.id,entry,level:1,quantity:1,equipped:false}));c.runtime.hp=7;return c;}
function context(sources?:Character['profile']){
 const counts:Record<string,number>={},memo=snapshotMemo();
 const remember:ReturnType<typeof snapshotMemo>= (scope,snapshot,compute)=>memo(scope,snapshot,()=>{counts[scope]=(counts[scope]||0)+1;return compute();});
 return {views:standaloneCardViews(entries,sources,[],remember),remember,counts};
}
const pause=async()=>{};

it('finishes real computations for three imported cards before any is selected, without changing their data',async()=>{
 const cards=[card(),card(),card()],original=JSON.stringify(cards),{views,remember,counts}=context(),progress=vi.fn();
 await prepareStandaloneCards(cards,views,{signal:new AbortController().signal,current:()=>true,yield:pause,progress});
 expect(progress).toHaveBeenLastCalledWith(3,3);
 expect(counts).toMatchObject({build:3,choices:3,review:3,'navigation-review':3,derived:3});
 const prepared={...counts};
 // These are the same reads performed by the visible sheet, on its very first selection.
 for(const c of [cards[2],cards[0],cards[1],cards[2]]){
  const build=views.build(c),display=views.display(c),reference=acknowledgedView(c,sheetChoices(c,entries));
  expect(build).toEqual(reference);
  expect(remember('choices',build,()=>sheetChoices(build,entries))).toEqual(sheetChoices(reference,entries));
  expect(remember('review',build,()=>cardMigrationIssues(build,entries))).toEqual(cardMigrationIssues(reference,entries));
  expect(remember('derived',display,()=>evaluate(display))).toEqual(evaluate(reference));
 }
 expect(counts).toEqual(prepared);expect(JSON.stringify(cards)).toBe(original);
},30000);

it('reuses construction work but preserves current runtime balances on explicit runtime forks',async()=>{
 const original=card(),{views,counts}=context();
 await prepareStandaloneCards([original],views,{signal:new AbortController().signal,current:()=>true,yield:pause});
 const changed=applyRuntimeCharacterEdit(original,runtimeValueEdit('hp',3))!;
 expect(changed).toBeDefined();expect(views.build(changed)).toBe(views.build(original));
 expect(views.display(changed).runtime.hp).toBe(3);expect(original.runtime.hp).toBe(7);
 expect(counts.build).toBe(1);
});

it('invalidates prepared work when card mechanics or the source context changes',async()=>{
 const original=card(),first=context();
 await prepareStandaloneCards([original],first.views,{signal:new AbortController().signal,current:()=>true,yield:pause});
 const changed={...original,abilities:{...original.abilities,str:18}};
 expect(first.views.ready(changed)).toBe(false);
 expect(first.views.build(changed)).not.toBe(first.views.build(original));
 const restricted=context({...original.profile,enabledSources:[]});
 expect(restricted.views.ready(original)).toBe(false);
 expect(restricted.views.build(original).profile.enabledSources).toEqual([]);
 expect(restricted.views.build(original)).not.toBe(first.views.build(original));
});

it('stops a cancelled batch before marking an unfinished card ready or mutating imported cards',async()=>{
 const cards=[card(),card()],original=JSON.stringify(cards),{views}=context(),controller=new AbortController();let tasks=0;
 await expect(prepareStandaloneCards(cards,views,{signal:controller.signal,current:()=>true,yield:async()=>{if(++tasks===2)controller.abort();}})).rejects.toMatchObject({name:'AbortError'});
 expect(views.ready(cards[0])).toBe(false);expect(views.ready(cards[1])).toBe(false);expect(JSON.stringify(cards)).toBe(original);
});

it('rejects an obsolete context so an import cannot publish a stale readiness result',async()=>{
 const original=card(),{views}=context();let current=true;
 await expect(prepareStandaloneCards([original],views,{signal:new AbortController().signal,current:()=>current,yield:async()=>{current=false;}})).rejects.toBeInstanceOf(CardPreparationContextChanged);
 expect(views.ready(original)).toBe(false);
});

it('yields before each expensive stage and skips completed cards on later background passes',async()=>{
 const c=card(),{views,counts}=context(),yieldTask=vi.fn(pause),options={signal:new AbortController().signal,current:()=>true,yield:yieldTask};let stages=0;
 const monitored={...views,steps:(owner:Character)=>views.steps(owner).map(step=>()=>{expect(yieldTask).toHaveBeenCalledTimes(stages+1);step();stages++;})};
 await prepareStandaloneCards([c],monitored,options);expect(stages).toBeGreaterThan(0);expect(counts['navigation-review']).toBe(1);
 const completed=stages;await prepareStandaloneCards([c],monitored,options);expect(stages).toBe(completed);expect(yieldTask).toHaveBeenCalledTimes(completed);
});

it('cancels a scheduled preparation without leaving a pending idle or timer task',async()=>{
 vi.useFakeTimers();try{
  const controller=new AbortController(),pending=yieldCardPreparation(controller.signal);controller.abort();
  await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(vi.getTimerCount()).toBe(0);
 }finally{vi.useRealTimers();}
});

it('completes the real first-open reconciliation during preparation, then skips that same completed check on selection',()=>{
 const c=card(),check=settledSnapshotCheck(true),views=standaloneCardViews(entries,undefined,[],snapshotMemo(),check),original=JSON.stringify(c);
 const sync=vi.fn(syncSourceSpells);
 expect(views.reconcile(c,sync)).toBeUndefined();expect(sync).toHaveBeenCalledTimes(1);
 const firstOpen=vi.fn(()=>false);expect(check(c,firstOpen)).toBe(false);expect(firstOpen).not.toHaveBeenCalled();
 expect(JSON.stringify(c)).toBe(original);
 const edited={...c,runtime:{...c.runtime,hp:4}};views.reconcile(edited,sync);expect(sync).toHaveBeenCalledTimes(2);
});

it('never treats a changed or failed reconciliation as settled and preserves spent manual resources',()=>{
 const c=card();c.runtime.resources.manual={current:1,max:3};
 const check=settledSnapshotCheck(true),views=standaloneCardViews(entries,undefined,[],snapshotMemo(),check),original=JSON.stringify(c);
 const changed=vi.fn((draft:Character)=>{draft.runtime.hp=2;return true;});
 const draft=views.reconcile(c,changed)!;expect(draft.runtime.hp).toBe(2);expect(draft.runtime.resources.manual.current).toBe(1);
 views.reconcile(c,changed);expect(changed).toHaveBeenCalledTimes(2);
 expect(()=>views.reconcile(c,()=>{throw Error('source failure');})).toThrow('source failure');
 views.reconcile(c,changed);expect(changed).toHaveBeenCalledTimes(3);expect(JSON.stringify(c)).toBe(original);
});
