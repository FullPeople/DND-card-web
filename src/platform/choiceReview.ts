import type {Character} from '../core/model';
import {choiceSource,type SheetChoice} from '../core/automation/choices';

/** Review scopes written by a legacy-card sync. The core records the class
 * rows in `featureLayout.ignoredClassGrants` (validated, exported, merged);
 * the platform adds every other root selection (race, background, feat) to
 * the same map so a reload, a re-imported Owlbear token with fresh row ids
 * or a later catalog/casting/feature pass cannot bring acknowledged gaps
 * back. The core keeps treating the map as "feat grants at or below the
 * reviewed level"; extra rows are harmless there because it only looks up a
 * choice's own owner id. */
type Scope={entryId:string;level:number};
export function recordReviewedRoots(c:Character){
 const layout=c.featureLayout||={order:[],expanded:[]};
 const scopes:Record<string,Scope>={...layout.ignoredClassGrants};
 for(const row of c.selections)if(!row.parentId&&!scopes[row.id])scopes[row.id]={entryId:row.entry.id,level:Number.isSafeInteger(row.level)?Math.max(0,Math.min(20,row.level)):0};
 layout.ignoredClassGrants=scopes;
}
const scopeFor=(scopes:Record<string,Scope>|undefined,row:{id:string;entry:{id:string}}|undefined)=>{
 if(!row||!scopes)return undefined;
 const own=scopes[row.id];if(own&&own.entryId===row.entry.id)return own;
 // A re-imported document gives rows new ids; the reviewed entry still matches.
 return Object.values(scopes).find(scope=>scope.entryId===row.entry.id);
};
/** Choice ids the sheet should treat as acknowledged although they are not in
 * `ignoredChoices`: answers the catalog cannot resolve yet, and gaps that
 * surfaced after the sync under a root reviewed at its current level.
 * Levelling a class past the reviewed level reopens that class's new gaps;
 * a choice the user resumed by hand stays open. */
export function reviewedLateChoices(c:Character,choices:SheetChoice[]):string[]{
 const layout=c.featureLayout,ignored=new Set(layout?.ignoredChoices||[]),resumed=new Set(layout?.resumedChoices||[]),out:string[]=[];
 for(const choice of choices){
  if(choice.complete||ignored.has(choice.id)||resumed.has(choice.id))continue;
  // Before the catalog has streamed in, a recorded tool or language answer
  // has no option list to resolve against: it is not a gap.
  if((choice.channel==='tools'||choice.channel==='languages')&&!choice.options.length&&(c.answers[choice.id]||[]).length>0){out.push(choice.id);continue;}
  if(!layout?.ignoredClassGrants)continue;
  const root=c.selections.find(row=>row.id===choiceSource(c,choice)),scope=scopeFor(layout.ignoredClassGrants,root);
  if(!root||!scope)continue;
  const covered=choice.grantLevel!==undefined?choice.grantLevel<=scope.level:root.entry.kind!=='class'||root.level<=scope.level;
  if(covered)out.push(choice.id);
 }
 return out;
}
/** A read-only view of the character whose acknowledgements include the late
 * choices above. Nothing is written: edits still go to the real character. */
export function acknowledgedView<T extends Character>(c:T,choices:SheetChoice[]):T{
 const late=reviewedLateChoices(c,choices);if(!late.length)return c;
 return {...c,featureLayout:{order:[],expanded:[],...c.featureLayout,ignoredChoices:[...new Set([...(c.featureLayout?.ignoredChoices||[]),...late])]}};
}
