import {createIdentity} from '../../data/automation/identity';
import {snapshotRecordErrors} from '../../data/automation/record-validation';
import type {AutomationRecord} from '../../data/automation/protocol';
import type {Entry} from '../model';
/** Private declarations still require an exact namespace and semantic validation. */
export function privateRecordValid(entry:Entry,catalogue:AutomationRecord[]=[]):boolean{
 const custom=entry.source==='CUSTOM'&&entry.packId==='custom',pack=entry.packId!=='kiwee'&&entry.source===entry.packId&&entry.id.startsWith(`${entry.packId}:`);
 if(!custom&&!pack||entry.automationVersion!==`${custom?'custom':'rulePack'}:${entry.revision}`||!entry.automation?.provenance.some(item=>item.layer==='rulePack'))return false;
 try{const packId=custom?'custom':'rulepack_'+Array.from(entry.packId).map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join(''),engName=`${custom?'Custom':'RulePack'} entry ${entry.id}`;
  return entry.automation.identity.key===createIdentity({kind:entry.kind,source:'CUSTOM',packId,engName}).key&&entry.automation.edition===entry.edition&&snapshotRecordErrors(entry.automation,catalogue).length===0;
 }catch{return false;}
}
