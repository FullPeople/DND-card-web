import {privateRecordValid} from './privateRecord';
import type {Character,Entry,RulePack} from '../model';
import type {AutomationData} from '../../data/automationOverlay';
import {supportedAutomation} from './state';
/** Loading changes an evaluation view. The stored source and protocol-2 card stay intact. */
export function bindAutomationEntries(entries:readonly Entry[],data?:AutomationData,catalog:readonly Entry[]=entries,packs:readonly RulePack[]=[]):Entry[]{
 const privateEntries=new Map(packs.flatMap(pack=>pack.entries).map(entry=>[entry.id,entry]));
 const prepared=entries.map(entry=>{
  const own=privateEntries.get(entry.id);if(own&&own.packId===entry.packId&&own.revision===entry.revision&&privateRecordValid(own,packs.flatMap(pack=>pack.entries).flatMap(entry=>entry.automation?[entry.automation]:[])))return own;
  if(privateRecordValid(entry))return entry;
  const {automation,automationVersion,...snapshot}=entry;return data?snapshot:(({automationOptions,...plain})=>plain)(snapshot);
 });
 return data?data.bind(prepared,catalog):prepared;
}
export function bindAutomationCharacter(c:Character,data:AutomationData|undefined,catalog:readonly Entry[],packs:readonly RulePack[]=[]):Character{
 if(!supportedAutomation(c))return c;
 const entries=bindAutomationEntries(c.selections.map(row=>row.entry),data,catalog,packs);
 const copies=c.quickbarCopies&&bindAutomationEntries(c.quickbarCopies.map(row=>row.entry),data,catalog,packs);
 return {...c,selections:c.selections.map((row,index)=>({...row,entry:entries[index]})),...(copies?{quickbarCopies:c.quickbarCopies!.map((row,index)=>({...row,entry:copies[index]}))}:{})};
}
