import {readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {RULE_STATUS_PATH,RULE_STATUS_LOCK,validateRuleSnapshot,validateSnapshotLock} from './automationRuleSnapshot.ts';
import {verifyCommittedRuleSnapshot,verifyRemoteRuleSnapshot} from './automationRuleProvenance.ts';
const {values}=parseArgs({options:{'data-repository':{type:'string'}}});
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'.local-evidence/automation-progress/source-provenance.json');
// An unsuccessful repeat must not leave a previous success receipt behind.
rmSync(out,{force:true});
const bytes=readFileSync(resolve(root,RULE_STATUS_PATH)),snapshot=validateRuleSnapshot(JSON.parse(bytes.toString()));
const lock=validateSnapshotLock(JSON.parse(readFileSync(resolve(root,RULE_STATUS_LOCK),'utf8')),bytes,snapshot);
mkdirSync(dirname(out),{recursive:true});
let report;
try{report=values['data-repository']?verifyCommittedRuleSnapshot(resolve(values['data-repository']),lock,bytes):verifyRemoteRuleSnapshot(lock,bytes);}
catch(error){writeFileSync(out,JSON.stringify({schemaVersion:1,verified:false,exportRevision:lock.revision,reason:error.message},null,2)+'\n');throw error;}
writeFileSync(out,JSON.stringify({...report,verified:true,verifiedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify(report));
