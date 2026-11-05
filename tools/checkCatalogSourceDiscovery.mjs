import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {catalogSourceDiscovery,verifyCommittedSourceDirectory,verifyRemoteSourceDirectory} from './catalogSourceDiscovery.ts';
const {values}=parseArgs({options:{'data-repository':{type:'string'}}}),root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'.local-evidence/automation-progress/source-directory-provenance.json');rmSync(out,{force:true});const {bytes,lock}=catalogSourceDiscovery(root);
const proof=values['data-repository']?verifyCommittedSourceDirectory(resolve(values['data-repository']),lock,bytes):verifyRemoteSourceDirectory(lock,bytes);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({...proof,verifiedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify(proof));
