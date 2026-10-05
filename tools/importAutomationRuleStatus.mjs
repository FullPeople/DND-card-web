// Import a generated artifact from the authoritative data repository.
// Never edits the capability descriptions, executable IR or player storage.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {RULE_STATUS_PATH,RULE_STATUS_LOCK,RULE_AUTHORITY,validateRuleSnapshot,validateSnapshotLock} from './automationRuleSnapshot.ts';
const {values}=parseArgs({options:{input:{type:'string'},revision:{type:'string'},branch:{type:'string'}}});
if(!values.input||!values.revision||!values.branch)throw Error('Usage: node tools/importAutomationRuleStatus.mjs --input <authoritative-export> --revision <full export commit SHA> --branch <data export branch>');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),bytes=readFileSync(values.input),snapshot=validateRuleSnapshot(JSON.parse(bytes.toString()));
const lock=validateSnapshotLock({schemaVersion:1,repository:RULE_AUTHORITY,branch:values.branch,revision:values.revision,path:'reports/progress/automation-rule-status.json',sha256:createHash('sha256').update(bytes).digest('hex'),sourceRevision:snapshot.authority.sourceRevision,irSha256:snapshot.authority.irSha256},bytes,snapshot);
// Replace atomically; the copy is generated, never a second editable authority.
for(const [path,data] of [[RULE_STATUS_PATH,bytes],[RULE_STATUS_LOCK,JSON.stringify(lock,null,2)+'\n']]){
 const target=resolve(root,path),temporary=target+'.import-'+process.pid;
 writeFileSync(temporary,data,{flag:'wx'});renameSync(temporary,target);
}
console.log(JSON.stringify({records:snapshot.records.length,reviewed:snapshot.records.filter(r=>r.reviewed).length,localMarkedComplete:snapshot.records.filter(r=>r.complete).length,authority:lock}));
